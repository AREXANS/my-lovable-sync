UPDATE lua_scripts
SET backup_content = replace(
  backup_content,
  'return loadstring(game:GetService("HttpService"):JSONDecode(game:HttpGet("https://firestore.googleapis.com/v1/projects/sharexans2/databases/(default)/documents/artifacts/sharexans-v2/public/data/scripts/UQ5i5o8LR0VwbnY0Bz85")).fields.content.stringValue)()',
  'local _gsUrl = "https://pahxndxofczkcszqhulz.supabase.co/functions/v1/get-script?name=game&raw=1&slot=backup"
                local _gsSrc
                for _attempt = 1, 3 do
                    local _ok, _res = pcall(function() return game:HttpGet(_gsUrl .. "&t=" .. tostring(tick())) end)
                    if _ok and type(_res) == "string" and #_res > 20 then _gsSrc = _res break end
                    task.wait(0.6)
                end
                if type(_gsSrc) ~= "string" or _gsSrc == "" then error("[Arexans] game.lua kosong / gagal diunduh") end
                local _gsLoad = loadstring or load
                if type(_gsLoad) ~= "function" then error("[Arexans] executor tidak punya loadstring") end
                local _gsFn, _gsErr = _gsLoad(_gsSrc, "=game.lua")
                if type(_gsFn) ~= "function" then error("[Arexans] game.lua compile error: " .. tostring(_gsErr)) end
                local _gsTbl = _gsFn()
                if type(_gsTbl) == "function" then _gsTbl = _gsTbl() end
                if type(_gsTbl) ~= "table" then error("[Arexans] game.lua tidak mengembalikan tabel") end
                return _gsTbl'
), updated_at = now()
WHERE name = 'main';