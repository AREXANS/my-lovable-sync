import { FC, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Upload, Trash2, RefreshCw, FileCode, Copy, ExternalLink, Shield, Search,
  History as HistoryIcon, Undo2, Redo2, RotateCcw, Download, Replace, Pencil, Save, Type, ClipboardPaste,
  Pin, PinOff, Archive, ArchiveRestore, Tag, ChevronDown, ChevronUp, Link2,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface UploadedScript {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  content: string;
  script_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  archived?: boolean;
  category?: string | null;
}

interface ScriptVersion {
  id: string;
  script_id: string;
  version_number: number;
  content: string;
  display_name: string | null;
  created_at: string;
}

/**
 * Protection wrapper: integrasi key system + whitelist + session cache.
 * Saat dieksekusi:
 *   1) Cek ArexansTools/ArexansTools_Session.json → kalau ada key valid, jalan langsung.
 *   2) Cek whitelist username (manual + license robloxUsers) di server.
 *   3) Kalau tidak whitelist, prompt input AXS key → simpan ke session file.
 *   4) Kalau key invalid → fake script.
 */
const PROTECTION_WRAPPER = (apiBase: string, scriptName: string, _userScript: string) => `--[[
============================================================
 ArexansTools — Auto-Protected Bootstrap (v3)
 - Session cache (file-presence only, no extra network round-trip)
 - Whitelist check
 - Floating Key System UI (cyan-blue style)
 - Payload streamed terpisah supaya script besar tetap aman
============================================================
]]
local HttpService = game:GetService("HttpService")
local CoreGui = game:GetService("CoreGui")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local LocalPlayer = Players.LocalPlayer or Players.PlayerAdded:Wait()
local username    = LocalPlayer.Name

local API_BASE         = "${apiBase}"
local SCRIPT_NAME      = "${scriptName}"

local function urlEncode(str)
    str = tostring(str or "")
    return (str:gsub("([^%w%-%_%.%~])", function(c) return string.format("%%%02X", string.byte(c)) end))
end

local PAYLOAD_URL      = API_BASE .. "/get-script?name=" .. urlEncode(SCRIPT_NAME) .. "&payload=1&raw=1"
local WHITELIST_API    = API_BASE .. "/get-whitelist?format=json"
local FAKE_SCRIPT_API  = API_BASE .. "/get-fake-script"
local VALIDATE_KEY_API = API_BASE .. "/validate-key"

local SESSION_FOLDER   = "ArexansTools"
local SESSION_FILE     = SESSION_FOLDER .. "/ArexansTools_Session.json"

if not _G.Arexans_Connections then _G.Arexans_Connections = {} end
local function ConnectEvent(event, func)
    local conn = event:Connect(func)
    table.insert(_G.Arexans_Connections, conn)
    return conn
end

local function getHwid()
    local ok, id = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
    return ok and id or (LocalPlayer.UserId .. "_fallback")
end
local HWID = getHwid()

local function safeRead()
    if not (isfile and readfile) then return nil end
    if not isfile(SESSION_FILE) then return nil end
    local ok, raw = pcall(readfile, SESSION_FILE)
    if not ok or not raw or raw == "" then return nil end
    local ok2, data = pcall(function() return HttpService:JSONDecode(raw) end)
    if ok2 and type(data) == "table" then return data end
    return nil
end

local function safeWrite(tbl)
    if not (writefile and makefolder) then return end
    pcall(function()
        if isfolder and not isfolder(SESSION_FOLDER) then makefolder(SESSION_FOLDER) end
        writefile(SESSION_FILE, HttpService:JSONEncode(tbl))
    end)
end

local function httpRequest(opts)
    local req = (syn and syn.request) or (http and http.request) or (fluxus and fluxus.request) or request or http_request
    if not req then
        local ok, body = pcall(function() return game:HttpGet(opts.Url) end)
        return ok and { StatusCode = 200, Body = body } or nil
    end
    local ok, res = pcall(req, opts)
    return ok and res or nil
end

local function loadLuaString(source, label)
    local loader = loadstring or load
    if type(loader) ~= "function" then warn("[ArexansTools] Executor tanpa loadstring/load."); return nil end
    if type(source) ~= "string" or source == "" then return nil end
    local fn, compileErr = loader(source)
    if type(fn) ~= "function" then warn("[ArexansTools] " .. tostring(label) .. " compile error: " .. tostring(compileErr)); return nil end
    return fn
end

local function MakeDraggable(guiObject, dragHandle)
    local dragInput, dragStart, startPos
    ConnectEvent(dragHandle.InputBegan, function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
            dragInput = input; dragStart = input.Position; startPos = guiObject.Position
        end
    end)
    ConnectEvent(UserInputService.InputChanged, function(input)
        if dragInput and (input.UserInputType == Enum.UserInputType.MouseMovement or input == dragInput) then
            local d = input.Position - dragStart
            guiObject.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
        end
    end)
    ConnectEvent(UserInputService.InputEnded, function(input)
        if dragInput and input.UserInputType == dragInput.UserInputType then dragInput = nil end
    end)
end

-- 1) Session cache: file-presence only (tidak validasi online → tidak nge-block payload)
local function tryCachedKey()
    local data = safeRead()
    if data and data.key and data.key ~= "" then
        print("[ArexansTools] Session ditemukan (role: " .. tostring(data.role or "Unknown") .. ")")
        return true
    end
    return false
end

local function checkWhitelist()
    local res = httpRequest({ Url = WHITELIST_API, Method = "GET" })
    if not res or not res.Body then return false end
    local ok, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
    if not (ok and data and data.success and data.usernames) then return false end
    local lname = string.lower(username)
    for _, u in ipairs(data.usernames) do
        if string.lower(u) == lname then return true end
    end
    return false
end

local function showKeyPromptUI()
    local parentGui = CoreGui
    local okp, pg = pcall(function() return Players.LocalPlayer:WaitForChild("PlayerGui") end)
    if not okp or not pg then pg = CoreGui end
    pcall(function() if parentGui:FindFirstChild("ArexansKeySystemGUI") then parentGui.ArexansKeySystemGUI:Destroy() end end)
    pcall(function() if pg:FindFirstChild("ArexansKeySystemGUI") then pg.ArexansKeySystemGUI:Destroy() end end)

    local function ButtonFx(button, flash)
        button.AutoButtonColor = false
        local orig = button.BackgroundTransparency
        local us = button:FindFirstChild("BFX") or Instance.new("UIScale", button); us.Name = "BFX"
        button.MouseButton1Down:Connect(function()
            TweenService:Create(us, TweenInfo.new(0.1), {Scale = 0.95}):Play()
            if flash then TweenService:Create(button, TweenInfo.new(0.1), {BackgroundTransparency = math.max(0, orig - 0.2)}):Play() end
        end)
        local function restore()
            TweenService:Create(us, TweenInfo.new(0.1), {Scale = 1}):Play()
            if flash then TweenService:Create(button, TweenInfo.new(0.2), {BackgroundTransparency = orig}):Play() end
        end
        button.MouseButton1Up:Connect(restore); button.MouseLeave:Connect(restore)
    end

    local keyGui = Instance.new("ScreenGui")
    keyGui.Name = "ArexansKeySystemGUI"; keyGui.ResetOnSpawn = false
    keyGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling; keyGui.DisplayOrder = 999
    local pOk = pcall(function() keyGui.Parent = CoreGui end)
    if not pOk then keyGui.Parent = pg end

    local Frame = Instance.new("Frame", keyGui)
    Frame.Size = UDim2.new(0, 280, 0, 150); Frame.Position = UDim2.new(0.5, -140, 0.5, -75)
    Frame.BackgroundColor3 = Color3.fromRGB(10, 10, 10); Frame.BackgroundTransparency = 0.2; Frame.BorderSizePixel = 0
    Instance.new("UICorner", Frame).CornerRadius = UDim.new(0, 8)
    local fs = Instance.new("UIStroke", Frame); fs.Color = Color3.fromRGB(0, 150, 255); fs.Thickness = 3

    local TitleBar = Instance.new("TextButton", Frame)
    TitleBar.Size = UDim2.new(1, 0, 0, 35); TitleBar.BackgroundTransparency = 1; TitleBar.Text = ""; TitleBar.AutoButtonColor = false

    local TitleLbl = Instance.new("TextLabel", TitleBar)
    TitleLbl.Size = UDim2.new(1, -40, 1, 0); TitleLbl.Position = UDim2.new(0, 10, 0, 0)
    TitleLbl.BackgroundTransparency = 1; TitleLbl.Text = "Arexans Key System"
    TitleLbl.Font = Enum.Font.GothamBold; TitleLbl.TextColor3 = Color3.fromRGB(255, 255, 255)
    TitleLbl.TextSize = 16; TitleLbl.TextXAlignment = Enum.TextXAlignment.Left
    local grad = Instance.new("UIGradient", TitleLbl)
    grad.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, Color3.fromRGB(0, 150, 255)),
        ColorSequenceKeypoint.new(0.5, Color3.fromRGB(0, 255, 255)),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 150, 255)),
    })
    grad.Rotation = 45
    task.spawn(function()
        while TitleLbl.Parent do grad.Rotation = (tick() * 50) % 360; RunService.Heartbeat:Wait() end
    end)

    local CloseBtn = Instance.new("TextButton", TitleBar)
    CloseBtn.Size = UDim2.new(0, 25, 0, 25); CloseBtn.Position = UDim2.new(1, -30, 0.5, 0); CloseBtn.AnchorPoint = Vector2.new(0, 0.5)
    CloseBtn.BackgroundColor3 = Color3.fromRGB(200, 50, 50); CloseBtn.BackgroundTransparency = 1
    CloseBtn.Text = "X"; CloseBtn.Font = Enum.Font.GothamBold; CloseBtn.TextColor3 = Color3.fromRGB(255, 100, 100); CloseBtn.TextSize = 16
    Instance.new("UICorner", CloseBtn).CornerRadius = UDim.new(0, 4)
    local cs = Instance.new("UIStroke", CloseBtn); cs.Color = Color3.fromRGB(255, 100, 100); cs.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    ButtonFx(CloseBtn, true)

    local Sep = Instance.new("Frame", Frame)
    Sep.Size = UDim2.new(1, -20, 0, 1); Sep.Position = UDim2.new(0, 10, 0, 35)
    Sep.BackgroundColor3 = Color3.fromRGB(0, 150, 255); Sep.BackgroundTransparency = 0.5; Sep.BorderSizePixel = 0

    local KeyBox = Instance.new("TextBox", Frame)
    KeyBox.Size = UDim2.new(1, -20, 0, 35); KeyBox.Position = UDim2.new(0, 10, 0, 45)
    KeyBox.BackgroundColor3 = Color3.fromRGB(30, 30, 40); KeyBox.BackgroundTransparency = 1
    KeyBox.TextColor3 = Color3.fromRGB(0, 150, 255); KeyBox.PlaceholderText = "Masukkan key..."
    KeyBox.PlaceholderColor3 = Color3.fromRGB(0, 100, 180); KeyBox.Text = ""
    KeyBox.Font = Enum.Font.GothamBold; KeyBox.TextSize = 14; KeyBox.ClearTextOnFocus = false
    Instance.new("UICorner", KeyBox).CornerRadius = UDim.new(0, 6)
    local ks = Instance.new("UIStroke", KeyBox); ks.Color = Color3.fromRGB(0, 150, 255); ks.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local Btns = Instance.new("Frame", Frame)
    Btns.Size = UDim2.new(1, -20, 0, 35); Btns.Position = UDim2.new(0, 10, 0, 90); Btns.BackgroundTransparency = 1

    local GetKeyBtn = Instance.new("TextButton", Btns)
    GetKeyBtn.Size = UDim2.new(0.48, 0, 1, 0); GetKeyBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255); GetKeyBtn.BackgroundTransparency = 1
    GetKeyBtn.Text = "Get Key"; GetKeyBtn.Font = Enum.Font.GothamBold; GetKeyBtn.TextColor3 = Color3.fromRGB(0, 150, 255); GetKeyBtn.TextSize = 14
    Instance.new("UICorner", GetKeyBtn).CornerRadius = UDim.new(0, 6)
    local gks = Instance.new("UIStroke", GetKeyBtn); gks.Color = Color3.fromRGB(0, 150, 255); gks.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local LoginBtn = Instance.new("TextButton", Btns)
    LoginBtn.Size = UDim2.new(0.48, 0, 1, 0); LoginBtn.Position = UDim2.new(0.52, 0, 0, 0)
    LoginBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255); LoginBtn.BackgroundTransparency = 1
    LoginBtn.Text = "Login"; LoginBtn.Font = Enum.Font.GothamBold; LoginBtn.TextColor3 = Color3.fromRGB(0, 150, 255); LoginBtn.TextSize = 14
    Instance.new("UICorner", LoginBtn).CornerRadius = UDim.new(0, 6)
    local lgs = Instance.new("UIStroke", LoginBtn); lgs.Color = Color3.fromRGB(0, 150, 255); lgs.ApplyStrokeMode = Enum.ApplyStrokeMode.Border

    local Status = Instance.new("TextLabel", Frame)
    Status.Size = UDim2.new(1, -20, 0, 20); Status.Position = UDim2.new(0, 10, 1, -25); Status.BackgroundTransparency = 1
    Status.Text = ""; Status.Font = Enum.Font.GothamBold; Status.TextColor3 = Color3.fromRGB(0, 150, 255); Status.TextSize = 14

    pcall(function() MakeDraggable(Frame, TitleBar) end)
    ButtonFx(GetKeyBtn, true); ButtonFx(LoginBtn, true)

    local result = { done = false, key = nil, cancelled = false }
    local busy = false

    CloseBtn.MouseButton1Click:Connect(function()
        result.cancelled = true; result.done = true
        pcall(function() keyGui:Destroy() end)
    end)

    GetKeyBtn.MouseButton1Click:Connect(function()
        if setclipboard then
            setclipboard("https://tools.arexans.my.id")
            Status.Text = "Link disalin!"; Status.TextColor3 = Color3.fromRGB(100, 255, 100)
        else
            Status.Text = "Clipboard tidak didukung"; Status.TextColor3 = Color3.fromRGB(255, 100, 100)
        end
    end)

    local function attemptLogin()
        if busy then return end
        local key = KeyBox.Text
        if not key or key == "" then
            Status.Text = "Masukkan key terlebih dahulu"; Status.TextColor3 = Color3.fromRGB(255, 200, 50); return
        end
        busy = true; Status.Text = "Memvalidasi..."; Status.TextColor3 = Color3.fromRGB(255, 255, 100); LoginBtn.Text = "..."
        task.spawn(function()
            local res = httpRequest({
                Url = VALIDATE_KEY_API, Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode({ key = key, hwid = HWID, robloxUsername = username }),
            })
            busy = false; LoginBtn.Text = "Login"
            if not res or not res.Body then
                Status.Text = "Gagal terhubung ke server"; Status.TextColor3 = Color3.fromRGB(255, 100, 100); return
            end
            local ok, parsed = pcall(function() return HttpService:JSONDecode(res.Body) end)
            if ok and parsed and parsed.success and parsed.valid then
                safeWrite({ key = key, savedAt = os.time(), role = parsed.role })
                Status.Text = (parsed.role or "Member") .. " | Valid"
                Status.TextColor3 = Color3.fromRGB(100, 255, 100)
                task.wait(0.6)
                result.key = key; result.done = true
                pcall(function() keyGui:Destroy() end)
            else
                local err = (parsed and (parsed.error or parsed.message)) or "Key tidak valid"
                Status.Text = tostring(err); Status.TextColor3 = Color3.fromRGB(255, 100, 100)
            end
        end)
    end

    LoginBtn.MouseButton1Click:Connect(attemptLogin)
    KeyBox.FocusLost:Connect(function(enter) if enter then attemptLogin() end end)

    local timeout = tick() + 600
    while not result.done and tick() < timeout do task.wait(0.2) end
    if not result.done then pcall(function() keyGui:Destroy() end) end
    return result.key
end

local function promptAndSaveKey()
    local key = showKeyPromptUI()
    return key ~= nil and key ~= ""
end

local function runFake()
    local res = httpRequest({ Url = FAKE_SCRIPT_API, Method = "GET" })
    if res and res.Body then
        local fn = loadLuaString(res.Body, "fake")
        if fn then pcall(fn) end
    else
        warn("[ArexansTools] Akses ditolak.")
    end
end

local authorized = false
if tryCachedKey() then
    authorized = true
    print("[ArexansTools] Akses diizinkan melalui cache lokal.")
elseif checkWhitelist() then
    authorized = true
    print("[ArexansTools] Whitelist verified for " .. username)
elseif promptAndSaveKey() then
    authorized = true
end

if not authorized then runFake(); return end

print("[ArexansTools] Access granted. Fetching payload...")

local payloadRes = httpRequest({ Url = PAYLOAD_URL, Method = "GET" })
if not payloadRes or not payloadRes.Body or payloadRes.Body == "" then
    warn("[ArexansTools] Gagal mengambil payload script.")
    return
end

local fn = loadLuaString(payloadRes.Body, "payload")
if not fn then return end

if getgenv then
    getgenv().AREXANS_SCRIPT_NAME = SCRIPT_NAME
    getgenv().AREXANS_PAYLOAD_URL = PAYLOAD_URL
end

local ok, resultOrErr = pcall(fn)
if not ok then
    warn("[ArexansTools] Payload runtime error: " .. tostring(resultOrErr))
elseif type(resultOrErr) == "function" then
    local ok2, err2 = pcall(resultOrErr)
    if not ok2 then warn("[ArexansTools] Payload returned function error: " .. tostring(err2)) end
end
`;

const LuaUploadManager: FC = () => {
  const [scripts, setScripts] = useState<UploadedScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rewrapping, setRewrapping] = useState(false);
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [historyScript, setHistoryScript] = useState<UploadedScript | null>(null);
  const [previewVersion, setPreviewVersion] = useState<ScriptVersion | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editScript, setEditScript] = useState<UploadedScript | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [redoStacks, setRedoStacks] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [tab, setTab] = useState<'semua' | 'sematkan' | 'arsip'>('semua');

  const catOf = (s: UploadedScript) => (s.category || 'umum').trim() || 'umum';
  const categories = Array.from(new Set(scripts.map(catOf))).sort();

  const q = searchQuery.trim().toLowerCase();
  const cq = categoryQuery.trim().toLowerCase();

  const inTab = (s: UploadedScript) =>
    tab === 'arsip' ? !!s.archived : tab === 'sematkan' ? !!s.pinned && !s.archived : !s.archived;

  const filteredScripts = scripts
    .filter(inTab)
    .filter((s) => (cq ? catOf(s).toLowerCase().includes(cq) : true))
    .filter((s) =>
      q
        ? (s.display_name || '').toLowerCase().includes(q) ||
          (s.name || '').toLowerCase().includes(q) ||
          (s.description || s.content || '').toLowerCase().includes(q)
        : true
    )
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  const counts = {
    semua: scripts.filter((s) => !s.archived).length,
    sematkan: scripts.filter((s) => !!s.pinned && !s.archived).length,
    arsip: scripts.filter((s) => !!s.archived).length,
  };

  const patchScript = async (script: UploadedScript, patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from('lua_scripts').update(patch as any).eq('id', script.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal memperbarui script', variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: msg });
    fetchScripts();
  };

  const togglePin = (s: UploadedScript) =>
    patchScript(s, { pinned: !s.pinned }, s.pinned ? 'Sematan dilepas' : 'Script disematkan');

  const toggleArchive = (s: UploadedScript) =>
    patchScript(s, { archived: !s.archived }, s.archived ? 'Dikembalikan dari arsip' : 'Script diarsipkan');

  const changeCategory = (s: UploadedScript) => {
    const next = prompt('Kategori script:', catOf(s));
    if (next === null) return;
    patchScript(s, { category: next.trim() || 'umum' }, `Kategori: ${next.trim() || 'umum'}`);
  };




  const SUPABASE_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  // Domain publik (bukan link supabase langsung) — di-rewrite ke edge function
  const PUBLIC_API_BASE = 'https://tools.arexans.my.id/api';

  // Kolom ringan saja — kolom isi script bisa sangat besar dan bikin query timeout.
  const LIST_COLUMNS =
    'id, name, display_name, description, script_type, is_active, created_at, updated_at, pinned, archived, category, obfuscate_enabled';

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lua_scripts')
        .select(LIST_COLUMNS)
        .eq('script_type', 'uploaded')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setScripts(((data || []) as any[]).map((s) => ({ ...s, content: '' })) as UploadedScript[]);
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal mengambil scripts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Ambil isi lengkap satu script saat benar-benar dibutuhkan (edit/copy/obfuscate).
  const fetchFull = async (script: UploadedScript): Promise<UploadedScript> => {
    const { data, error } = await supabase
      .from('lua_scripts')
      .select('id, content, raw_content, plain_content, obfuscate_enabled')
      .eq('id', script.id)
      .maybeSingle();
    if (error || !data) return script;
    return { ...script, ...(data as any) } as UploadedScript;
  };

  useEffect(() => { fetchScripts(); }, []);

  const wrap = (name: string, raw: string) => PROTECTION_WRAPPER(SUPABASE_API_BASE, name, raw);

  // Auto-obfuscate Lua source via edge function (luast.clv.cloud).
  // Falls back to original source if the service fails so upload never blocks.
  const obfuscateSource = async (raw: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('obfuscate-lua', {
        body: { code: raw, preset: 'level3', outputStyle: 'singleline' },
      });
      if (error) throw error;
      const result = (data as any)?.result ?? (data as any)?.code ?? (data as any)?.obfuscated;
      if (typeof result === 'string' && result.trim()) return result;
      return raw;
    } catch {
      return raw;
    }
  };

  const isObfOn = (s: UploadedScript) => (s as any).obfuscate_enabled !== false;

  /**
   * Build DB payload from a plain (readable) source.
   * Kalau obfuscate aktif: payload user DAN kode integrasi (wrapper) sama-sama
   * di-obfuscate lewat Luast supaya sulit dibaca.
   */
  const buildPayload = async (name: string, plain: string, enabled: boolean) => {
    const raw = enabled ? await obfuscateSource(plain) : plain;
    const wrappedPlain = wrap(name, raw);
    const content = enabled ? await obfuscateSource(wrappedPlain) : wrappedPlain;
    return {
      plain_content: plain,
      raw_content: raw,
      content,
      obfuscate_enabled: enabled,
      wasObfuscated: enabled && (raw !== plain || content !== wrappedPlain),
    };
  };

  /**
   * Sumber kode terbaca (plain) dari sebuah script.
   * PENTING: raw_content bisa berisi hasil obfuscate kalau sakelar sedang ON,
   * jadi jangan pernah dipakai sebagai "plain" dalam kondisi itu.
   */
  const plainOf = (script: UploadedScript) => {
    const plain = (script as any).plain_content as string | null | undefined;
    if (plain && plain.trim()) return plain;
    const rawc = (script as any).raw_content as string | null | undefined;
    if (!isObfOn(script) && rawc && rawc.trim()) return rawc;
    return unwrap(script.content || '');
  };

  const toggleObfuscate = async (script: UploadedScript) => {
    const next = !isObfOn(script);
    try {
      const full = await fetchFull(script);
      const plain = plainOf(full);
      const hasPlain = Boolean(((full as any).plain_content || '').trim());

      if (!next && !hasPlain) {
        // Tidak ada salinan kode terbaca tersimpan → tidak bisa dikembalikan ke mentah.
        toast({
          title: 'Tidak bisa dimatikan',
          description: `"${script.display_name}" tidak menyimpan kode aslinya. Upload / paste ulang script ini sekali lagi, setelah itu sakelar Obf bisa dimatikan kapan saja.`,
          variant: 'destructive',
        });
        return;
      }

      const p = await buildPayload(full.name, plain, next);
      const { error } = await supabase.from('lua_scripts').update({
        content: p.content, raw_content: p.raw_content, plain_content: p.plain_content,
        obfuscate_enabled: p.obfuscate_enabled, updated_at: new Date().toISOString(),
      } as any).eq('id', script.id);
      if (error) throw error;
      toast({
        title: next ? 'Obfuscate ON' : 'Obfuscate OFF',
        description: `"${script.display_name}" ${next ? 'di-obfuscate (payload + kode integrasi)' : 'langsung dikembalikan ke kode mentah/terbaca'}`,
      });
      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal mengubah status obfuscate', variant: 'destructive' });
    }
  };



  const unwrap = (wrapped: string): string => {
    const marker = '-- USER SCRIPT (PROTECTED)';
    const idx = wrapped.indexOf(marker);
    if (idx === -1) return wrapped;
    const afterMarker = wrapped.substring(idx + marker.length);
    const nl = afterMarker.indexOf('\n');
    return afterMarker.substring(nl + 1).replace(/\n$/, '');
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!['.lua', '.txt'].includes(ext)) {
      toast({ title: 'Error', description: 'Hanya .lua atau .txt', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const rawOriginal = await file.text();
      const scriptName = file.name.replace(/\.(lua|txt)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const dbName = `uploaded_${scriptName}`;

      const { data: existing } = await supabase.from('lua_scripts').select('id, obfuscate_enabled').eq('name', dbName).maybeSingle();
      const enabled = existing ? (existing as any).obfuscate_enabled !== false : true;
      const p = await buildPayload(dbName, rawOriginal, enabled);
      const wasObfuscated = p.wasObfuscated;

      if (existing) {
        const { error } = await supabase.from('lua_scripts')
          .update({ content: p.content, raw_content: p.raw_content, plain_content: p.plain_content, obfuscate_enabled: enabled, updated_at: new Date().toISOString() } as any).eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${file.name}" diupdate${wasObfuscated ? ' + auto-obfuscated' : ''}` });
      } else {
        const { error } = await supabase.from('lua_scripts').insert({
          name: dbName, display_name: file.name,
          description: `Auto-integrated: key system${wasObfuscated ? ' + obfuscated' : ''}`,
          content: p.content, raw_content: p.raw_content, plain_content: p.plain_content,
          obfuscate_enabled: enabled, script_type: 'uploaded', is_active: true,
        } as any);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${file.name}" diupload${wasObfuscated ? ' + auto-obfuscated' : ''}` });
      }

      fetchScripts();
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal upload', variant: 'destructive' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handlePasteUpload = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast({ title: 'Clipboard kosong', variant: 'destructive' });
        return;
      }
      const rawName = prompt('Nama file script (contoh: myscript.lua):', 'pasted_script.lua');
      if (rawName === null) return;
      const fileName = (rawName.trim() || 'pasted_script.lua').replace(/\s+/g, '_');
      const displayName = /\.(lua|txt)$/i.test(fileName) ? fileName : `${fileName}.lua`;
      const scriptName = displayName.replace(/\.(lua|txt)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const dbName = `uploaded_${scriptName}`;
      setUploading(true);
      const { data: existing } = await supabase.from('lua_scripts').select('id, obfuscate_enabled').eq('name', dbName).maybeSingle();
      const enabled = existing ? (existing as any).obfuscate_enabled !== false : true;
      const p = await buildPayload(dbName, text, enabled);
      const wasObfuscated = p.wasObfuscated;
      if (existing) {
        if (!confirm(`Script "${displayName}" sudah ada. Timpa dengan isi clipboard?`)) { setUploading(false); return; }
        const { error } = await supabase.from('lua_scripts')
          .update({ content: p.content, raw_content: p.raw_content, plain_content: p.plain_content, obfuscate_enabled: enabled, updated_at: new Date().toISOString() } as any).eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${displayName}" diupdate dari clipboard${wasObfuscated ? ' + auto-obfuscated' : ''}` });
      } else {
        const { error } = await supabase.from('lua_scripts').insert({
          name: dbName, display_name: displayName,
          description: `Auto-integrated: key system (from clipboard)${wasObfuscated ? ' + obfuscated' : ''}`,
          content: p.content, raw_content: p.raw_content, plain_content: p.plain_content,
          obfuscate_enabled: enabled, script_type: 'uploaded', is_active: true,
        } as any);
        if (error) throw error;
        toast({ title: 'Berhasil', description: `"${displayName}" diupload dari clipboard${wasObfuscated ? ' + auto-obfuscated' : ''}` });
      }

      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal paste dari clipboard', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const reWrapAll = async () => {
    if (!confirm('Re-wrap semua script dengan wrapper terbaru (key system + whitelist)?')) return;
    setRewrapping(true);
    try {
      for (const s of scripts) {
        const full = await fetchFull(s);
        const raw = (full as any).plain_content || (full as any).raw_content || unwrap(full.content || '');
        const newWrapped = wrap(s.name, raw);
        await supabase.from('lua_scripts').update({
          content: newWrapped, raw_content: raw, updated_at: new Date().toISOString(),
        } as any).eq('id', s.id);
      }
      toast({ title: 'Berhasil', description: `${scripts.length} script di-rewrap` });
      fetchScripts();
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal re-wrap', variant: 'destructive' });
    } finally {
      setRewrapping(false);
    }
  };

  const deleteScript = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('lua_scripts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: `"${name}" dihapus` });
      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal menghapus', variant: 'destructive' });
    }
  };

  const openHistory = async (script: UploadedScript) => {
    setHistoryScript(script);
    setPreviewVersion(null);
    const { data, error } = await supabase
      .from('lua_script_versions')
      .select('*')
      .eq('script_id', script.id)
      .order('version_number', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: 'Gagal load history', variant: 'destructive' });
      return;
    }
    setVersions(data || []);
  };

  const restoreVersion = async (version: ScriptVersion) => {
    if (!historyScript) return;
    if (!confirm(`Restore versi #${version.version_number}? Versi saat ini akan disimpan ke history.`)) return;
    const { error } = await supabase.from('lua_scripts').update({
      content: version.content, updated_at: new Date().toISOString(),
    }).eq('id', historyScript.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal restore', variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: `Restored ke v${version.version_number}` });
    setHistoryScript(null);
    fetchScripts();
  };

  const undoToPrevious = async (script: UploadedScript) => {
    const { data } = await supabase
      .from('lua_script_versions')
      .select('*')
      .eq('script_id', script.id)
      .order('version_number', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) {
      toast({ title: 'Tidak ada history', description: 'Belum ada versi sebelumnya' });
      return;
    }
    const prev = data[0];
    const currentContent = (await fetchFull(script)).content || '';
    const { error } = await supabase.from('lua_scripts').update({
      content: prev.content, updated_at: new Date().toISOString(),
    }).eq('id', script.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal undo', variant: 'destructive' });
      return;
    }
    setRedoStacks((s) => ({ ...s, [script.id]: [...(s[script.id] || []), currentContent] }));
    toast({ title: 'Undo berhasil', description: `Kembali ke v${prev.version_number}` });
    fetchScripts();
  };

  const redoToNext = async (script: UploadedScript) => {
    const stack = redoStacks[script.id] || [];
    if (stack.length === 0) {
      toast({ title: 'Tidak ada redo', description: 'Belum ada versi terbaru untuk dikembalikan' });
      return;
    }
    const next = stack[stack.length - 1];
    const { error } = await supabase.from('lua_scripts').update({
      content: next, updated_at: new Date().toISOString(),
    }).eq('id', script.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal redo', variant: 'destructive' });
      return;
    }
    setRedoStacks((s) => ({ ...s, [script.id]: stack.slice(0, -1) }));
    toast({ title: 'Redo berhasil', description: 'Kembali ke versi terbaru' });
    fetchScripts();
  };

  const copyRawScript = async (script: UploadedScript) => {
    const raw = plainOf(await fetchFull(script));
    navigator.clipboard.writeText(raw);
    toast({ title: 'Copied!', description: 'Script mentah disalin' });
  };

  const pasteIntoScript = async (script: UploadedScript) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast({ title: 'Clipboard kosong', variant: 'destructive' });
        return;
      }
      if (!confirm(`Ganti isi "${script.display_name}" dengan isi clipboard (${text.length} karakter)?`)) return;
      const p = await buildPayload(script.name, text, isObfOn(script));
      const { error } = await supabase.from('lua_scripts')
        .update({ content: p.content, raw_content: p.raw_content, plain_content: p.plain_content, obfuscate_enabled: p.obfuscate_enabled, updated_at: new Date().toISOString() } as any)
        .eq('id', script.id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: `Script diganti dari clipboard${p.wasObfuscated ? ' + auto-obfuscated' : ''}` });


      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal paste dari clipboard', variant: 'destructive' });
    }
  };

  const getScriptUrl = (n: string) => `${PUBLIC_API_BASE}/get-script?name=${n}`;
  const getFakeUrl = () => `${PUBLIC_API_BASE}/get-fake-script`;

  const copyUrl = (n: string) => { navigator.clipboard.writeText(getScriptUrl(n)); toast({ title: 'Copied!' }); };
  const copyLoadstring = (n: string) => {
    navigator.clipboard.writeText(`loadstring(game:HttpGet("${getScriptUrl(n)}"))()`);
    toast({ title: 'Copied!', description: 'Loadstring disalin' });
  };

  const randVar = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let s = '_';
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const toLuaLiteral = (bytes: number[]) => {
    let out = '';
    for (const b of bytes) {
      if (b === 0x22) out += '\\"';
      else if (b === 0x5c) out += '\\\\';
      else if (b >= 32 && b <= 126) out += String.fromCharCode(b);
      else out += '\\' + b;
    }
    return out;
  };

  const copyObfuscatedLoadstring = (n: string) => {
    const url = getScriptUrl(n);
    // Sembunyikan SELURUH ekspresi (termasuk game:HttpGet + URL) sebagai XOR+hex.
    // Inner blob decode -> `return game:HttpGet("URL")`, di-loadstring lalu di-loadstring lagi.
    const key = 1 + Math.floor(Math.random() * 254);
    const inner = `return game:HttpGet("${url}")`;
    const hex = Array.from(new TextEncoder().encode(inner))
      .map((b) => ((b ^ key) & 0xff).toString(16).padStart(2, '0'))
      .join('');
    const code = `loadstring(loadstring(("${hex}"):gsub('..',function(h)return string.char(bit32.bxor(tonumber(h,16),${key}))end))())()`;
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied!', description: 'Loadstring obfuscate (full-hidden) disalin' });
  };
  const copyIntegratedCode = async (script: UploadedScript) => {
    const full = await fetchFull(script);
    navigator.clipboard.writeText(full.content || '');
    toast({ title: 'Copied!', description: 'Kode terintegrasi lengkap disalin' });
  };

  const downloadRawFile = async (script: UploadedScript) => {
    // Download raw (unwrapped) content — no key system / whitelist integration
    const raw = plainOf(await fetchFull(script));
    const fileName = /\.(lua|txt)$/i.test(script.display_name) ? script.display_name : `${script.display_name}.lua`;
    const blob = new Blob([raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `"${fileName}" berhasil diunduh (tanpa integrasi)` });
  };

  const handleReplaceUpload = async (script: UploadedScript, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!['.lua', '.txt'].includes(ext)) {
      toast({ title: 'Error', description: 'Hanya .lua atau .txt', variant: 'destructive' });
      event.target.value = '';
      return;
    }
    if (!confirm(`Ganti isi "${script.display_name}" dengan "${file.name}"? Versi lama tetap tersimpan di history.`)) {
      event.target.value = '';
      return;
    }
    try {
      const p = await buildPayload(script.name, await file.text(), isObfOn(script));
      const { error } = await supabase.from('lua_scripts')
        .update({ content: p.content, raw_content: p.raw_content, plain_content: p.plain_content, obfuscate_enabled: p.obfuscate_enabled, display_name: file.name, updated_at: new Date().toISOString() } as any)
        .eq('id', script.id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: `"${script.display_name}" diganti dengan "${file.name}"${p.wasObfuscated ? ' + auto-obfuscated' : ''}` });
      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal mengganti file', variant: 'destructive' });
    } finally {
      event.target.value = '';
    }
  };

  const openEditor = async (script: UploadedScript) => {
    setEditScript(script);
    setEditName(script.display_name);
    setEditContent('-- memuat isi script...');
    const full = await fetchFull(script);
    setEditScript(full);
    setEditContent(plainOf(full));
  };

  const saveEdit = async () => {
    if (!editScript) return;
    const newName = editName.trim() || editScript.display_name;
    setSavingEdit(true);
    try {
      const p = await buildPayload(editScript.name, editContent, isObfOn(editScript));
      const { error } = await supabase.from('lua_scripts')
        .update({ content: p.content, raw_content: p.raw_content, plain_content: p.plain_content, obfuscate_enabled: p.obfuscate_enabled, display_name: newName, updated_at: new Date().toISOString() } as any)
        .eq('id', editScript.id);
      if (error) throw error;
      toast({ title: 'Berhasil', description: `"${newName}" diupdate${p.wasObfuscated ? ' + auto-obfuscated' : ''}` });


      setEditScript(null);
      fetchScripts();
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const renameScript = async (script: UploadedScript) => {
    const newName = prompt('Nama script baru:', script.display_name);
    if (newName === null) return;
    if (!newName.trim()) {
      toast({ title: 'Error', description: 'Nama tidak boleh kosong', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('lua_scripts')
      .update({ display_name: newName.trim(), updated_at: new Date().toISOString() })
      .eq('id', script.id);
    if (error) {
      toast({ title: 'Error', description: 'Gagal ganti nama', variant: 'destructive' });
      return;
    }
    toast({ title: 'Berhasil', description: `Nama diubah ke "${newName.trim()}"` });
    fetchScripts();
  };



  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-display font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
            <span className="truncate">Upload Lua Scripts</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Upload .lua — otomatis terintegrasi key system + whitelist database
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={reWrapAll} disabled={rewrapping || scripts.length === 0} title="Re-wrap semua dengan wrapper terbaru">
            <RotateCcw className={`w-4 h-4 ${rewrapping ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchScripts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 sm:p-6">
          <input type="file" accept=".lua,.txt" ref={fileInputRef} onChange={handleUpload} className="hidden" />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-xl p-6 sm:p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
          >
            <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-primary/50" />
            <p className="text-sm font-medium mb-1">{uploading ? 'Uploading...' : 'Klik untuk upload file Lua'}</p>
            <p className="text-xs text-muted-foreground">File .lua atau .txt — auto-wrap key system + whitelist</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs h-9 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
            onClick={handlePasteUpload}
            disabled={uploading}
          >
            <ClipboardPaste className="w-3 h-3 mr-1" />
            Upload dari Clipboard (Paste)
          </Button>
          <div className="mt-3 p-2 rounded bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2 text-xs text-primary">
              <Shield className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>Script otomatis cek <code className="text-[10px]">ArexansTools_Session.json</code> → kalau key valid langsung jalan, kalau tidak cek whitelist, kalau bukan whitelist minta input key.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6 space-y-3">
          <div>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              Script Ter-upload ({filteredScripts.length}/{scripts.length})
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Semua script terproteksi key system · sematkan yang sering dipakai, arsipkan yang lama
            </CardDescription>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/30 border border-border/60">
            {([
              { k: 'semua', label: 'Semua', icon: FileCode },
              { k: 'sematkan', label: 'Sematkan', icon: Pin },
              { k: 'arsip', label: 'Arsip', icon: Archive },
            ] as const).map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                  tab === k ? 'bg-primary/20 text-primary border border-primary/40' : 'text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
                <span className="opacity-70">({counts[k]})</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari script (nama / isi kode)..."
                className="pl-9 h-9 text-xs bg-black/20"
              />
            </div>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Cari kategori..."
                className="pl-9 h-9 text-xs bg-black/20"
                list="upload-script-categories"
              />
              <datalist id="upload-script-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategoryQuery('')}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  cq === '' ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                Semua kategori
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryQuery(c)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    cq === c.toLowerCase() ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-3 sm:px-6">
          {filteredScripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{scripts.length === 0 ? 'Belum ada script' : 'Tidak ada script yang cocok'}</p>
            </div>
          ) : (
            <div className="max-h-[75vh] overflow-y-auto pr-1">
              <div className="space-y-3">
                {filteredScripts.map((script) => (
                  <div
                    key={script.id}
                    className={`p-3 rounded-lg border transition-colors space-y-2 ${
                      script.archived
                        ? 'bg-muted/20 border-border/50 opacity-80'
                        : script.pinned
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-muted/30 hover:bg-muted/50 border-border/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {script.pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                          <p className="font-medium text-sm truncate">{script.display_name}</p>
                          <button
                            type="button"
                            onClick={() => changeCategory(script)}
                            title="Ubah kategori"
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                          >
                            <Tag className="w-2.5 h-2.5 mr-0.5 inline" />{catOf(script)}
                          </button>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />KeySystem
                          </Badge>
                          {script.archived && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400">
                              Arsip
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleObfuscate(script)}
                            title={isObfOn(script) ? 'Obfuscate aktif — klik untuk matikan' : 'Obfuscate mati — klik untuk aktifkan'}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              isObfOn(script)
                                ? 'border-primary/50 bg-primary/15 text-primary'
                                : 'border-border bg-muted/40 text-muted-foreground'
                            }`}
                          >
                            Obf {isObfOn(script) ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(script.updated_at).toLocaleString('id-ID')}</p>
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap justify-end">
                        <input
                          type="file"
                          accept=".lua,.txt"
                          ref={(el) => { replaceInputRefs.current[script.id] = el; }}
                          onChange={(e) => handleReplaceUpload(script, e)}
                          className="hidden"
                        />
                        <Button variant="ghost" size="sm" onClick={() => togglePin(script)} title={script.pinned ? 'Lepas sematan' : 'Sematkan script'} className={`h-8 w-8 p-0 ${script.pinned ? 'text-primary' : ''}`}>
                          {script.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleArchive(script)} title={script.archived ? 'Keluarkan dari arsip' : 'Arsipkan script'} className={`h-8 w-8 p-0 ${script.archived ? 'text-amber-400' : ''}`}>
                          {script.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => openEditor(script)} title="Edit isi script" className="h-8 w-8 p-0">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => renameScript(script)} title="Ganti nama script" className="h-8 w-8 p-0">
                          <Type className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => replaceInputRefs.current[script.id]?.click()} title="Upload ulang / ganti file" className="h-8 w-8 p-0">
                          <Replace className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => undoToPrevious(script)} title="Undo ke versi sebelumnya" className="h-8 w-8 p-0">
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => redoToNext(script)}
                          disabled={!(redoStacks[script.id]?.length)}
                          title="Redo ke versi setelahnya"
                          className="h-8 w-8 p-0"
                        >
                          <Redo2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openHistory(script)} title="Lihat history versi" className="h-8 w-8 p-0">
                          <HistoryIcon className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteScript(script.id, script.display_name)} title="Hapus script" className="text-destructive hover:text-destructive h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <Input readOnly value={getScriptUrl(script.name)} className="font-mono text-[10px] h-7 bg-black/30" />
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Salin URL" onClick={() => copyUrl(script.name)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Buka URL" onClick={() => window.open(getScriptUrl(script.name), '_blank')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button variant="outline" size="sm" className="text-xs h-7" title="Salin loadstring untuk executor" onClick={() => copyLoadstring(script.name)}>
                          <Copy className="w-3 h-3 mr-1" />
                          Loadstring
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7" title="Salin kode terintegrasi (key + whitelist)" onClick={() => copyIntegratedCode(script)}>
                          <FileCode className="w-3 h-3 mr-1" />
                          Kode Integrasi
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7" title="Salin script mentah (tanpa integrasi)" onClick={() => copyRawScript(script)}>
                          <Copy className="w-3 h-3 mr-1" />
                          Salin Mentah
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7" title="Ganti isi script dari clipboard" onClick={() => pasteIntoScript(script)}>
                          <ClipboardPaste className="w-3 h-3 mr-1" />
                          Paste
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-7 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                        title="Salin loadstring dengan URL ter-obfuscate (tetap jalan di executor)"
                        onClick={() => copyObfuscatedLoadstring(script.name)}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        Loadstring Obfuscate
                      </Button>
                      <Button variant="outline" size="sm" className="w-full text-xs h-7" title="Unduh file mentah tanpa integrasi" onClick={() => downloadRawFile(script)}>
                        <Download className="w-3 h-3 mr-1" />
                        Download File Mentah
                      </Button>
                    </div>


                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Fake Script API
          </CardTitle>
          <CardDescription className="text-xs">Endpoint fake source untuk user gagal autentikasi</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 space-y-2">
          <div className="flex gap-1.5">
            <Input readOnly value={getFakeUrl()} className="font-mono text-xs bg-black/30" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(getFakeUrl()); toast({ title: 'Copied!' }); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History dialog */}
      <Dialog open={!!historyScript} onOpenChange={(o) => { if (!o) { setHistoryScript(null); setPreviewVersion(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="w-4 h-4" />
              History: {historyScript?.display_name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Versi tersimpan otomatis tiap kali script diupdate (max 20 versi terakhir).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden flex-1">
            <ScrollArea className="border rounded p-2 max-h-[60vh]">
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Belum ada versi tersimpan</p>
              ) : (
                <div className="space-y-1">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setPreviewVersion(v)}
                      className={`w-full text-left p-2 rounded text-xs hover:bg-muted/50 transition ${previewVersion?.id === v.id ? 'bg-primary/10 border border-primary/30' : ''}`}
                    >
                      <div className="font-medium">Versi #{v.version_number}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleString('id-ID')}</div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="flex flex-col gap-2 overflow-hidden">
              {previewVersion ? (
                <>
                  <ScrollArea className="border rounded p-2 max-h-[50vh] bg-black/30">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">{previewVersion.content.substring(0, 5000)}{previewVersion.content.length > 5000 ? '\n...(truncated)' : ''}</pre>
                  </ScrollArea>
                  <Button onClick={() => restoreVersion(previewVersion)} className="w-full">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore versi #{previewVersion.version_number}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Pilih versi untuk preview</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editScript} onOpenChange={(o) => { if (!o) setEditScript(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Edit: {editScript?.display_name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubah isi script mentah. Wrapper key system + whitelist akan otomatis diterapkan saat disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nama Script</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama script..." className="h-8 text-xs" />
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { navigator.clipboard.writeText(editContent); toast({ title: 'Copied!', description: 'Script disalin' }); }}>
              <Copy className="w-3 h-3 mr-1" />
              Salin
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (!t) { toast({ title: 'Clipboard kosong', variant: 'destructive' }); return; }
                setEditContent(t);
                toast({ title: 'Pasted!', description: 'Isi clipboard dimuat' });
              } catch {
                toast({ title: 'Error', description: 'Gagal paste', variant: 'destructive' });
              }
            }}>
              <ClipboardPaste className="w-3 h-3 mr-1" />
              Paste
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setEditContent('')}>
              <Trash2 className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full flex-1 min-h-[400px] font-mono text-xs bg-black/50 border border-primary/30 rounded p-3 outline-none focus:border-primary"
            spellCheck={false}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditScript(null)}>Batal</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Menyimpan...</> : <><Save className="w-3 h-3 mr-1" />Simpan</>}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </div>

  );
};

export default LuaUploadManager;
