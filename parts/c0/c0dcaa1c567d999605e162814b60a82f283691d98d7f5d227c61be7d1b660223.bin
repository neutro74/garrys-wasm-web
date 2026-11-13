local EmptyFunc = function() end

local debugInfoTbl = debug.getinfo(EmptyFunc)

local cv_do_check = CreateConVar("sv_tfa_envcheck", "1", {FCVAR_ARCHIVE, FCVAR_NOTIFY, FCVAR_REPLICATED}, "Enable environment sanity checks and warnings?")

local function checkEnv(plyIn)
	if not cv_do_check:GetBool() then return end

	local function printFunc(msg, ...)
		msg = "[TFA Base] " .. msg

		if chat and chat.AddText then
			return chat.AddText(msg, ...)
		end

		return print(msg, ...)
	end

	if game.SinglePlayer() then
		local shortsrc = debugInfoTbl.short_src

		if shortsrc:StartWith("addons") then -- legacy/unpacked addon
			local addonRootFolder = shortsrc:GetPathFromFilename():Replace("lua/tfa/modules/", "")

			if not file.Exists(addonRootFolder .. ".git", "GAME") then -- assume unpacked version by missing .git folder, which is ignored by gmad.exe
				printFunc("You are using unpacked version of TFA Base.\nWe only provide support for Steam Workshop version.")
			end
		end
	else
		local activeGamemode = engine.ActiveGamemode()
		local isRP = activeGamemode:find("rp")
				or activeGamemode:find("roleplay")
				or activeGamemode:find("serious")

		if isRP and (SERVER or (IsValid(plyIn) and (plyIn:IsAdmin() or plyIn:IsSuperAdmin()))) then
			print("You are running the base on DarkRP or DarkRP-derived gamemode. We can't guarantee that it will work correctly with any possible addons the server might have installed (especially the paid ones), so we don't provide support for RP gamemodes/servers. If you've encountered a conflict error with another addon, it's most likely that addon's fault. DO NOT CONTACT US ABOUT THAT!")
		end
	end

	timer.Simple(0, function()
		if not TFA.BASE_LOAD_COMPLETE or not TFA.SWEP_LOAD_COMPLETE then
			printFunc("Some of the base's modules have failed to load. You are probably going over Lua files limit. Try disabling some addons until you stop getting this error.")
		end
	end)
end

if CLIENT then
	hook.Add("HUDPaint", "TFA_CheckEnv", function()
		local ply = LocalPlayer()

		if not IsValid(ply) then return end

		hook.Remove("HUDPaint", "TFA_CheckEnv")

		checkEnv(ply)
	end)
else
	resource.AddWorkshop("2840031720")

	hook.Add("InitPostEntity", "TFA_CheckEnv", checkEnv)
end
