CreateConVar("bon_speed_walk", "50", FCVAR_ARCHIVE, "Bon walking speed", 1, 500)
CreateConVar("bon_speed_run", "550", FCVAR_ARCHIVE, "Bon running speed", 1, 1000) 
CreateConVar("bon_speed_crouch", "40", FCVAR_ARCHIVE, "Bon crouching/crawling speed", 1, 300)

CreateConVar("bon_sound_volume_walk", "67", FCVAR_ARCHIVE, "Bon walking sound volume", 0, 200)
CreateConVar("bon_sound_volume_run", "67", FCVAR_ARCHIVE, "Bon running sound volume", 0, 200)
CreateConVar("bon_sound_volume_crouch", "70", FCVAR_ARCHIVE, "Bon crawling sound volume", 0, 200)
CreateConVar("bon_sound_volume_idle", "100", FCVAR_ARCHIVE, "Bon idle sound volume", 0, 200)
CreateConVar("bon_sound_volume_jumpscare", "100", FCVAR_ARCHIVE, "Bon jumpscare sound volume", 0, 200)

CreateConVar("bon_sound_pitch_walk", "100", FCVAR_ARCHIVE, "Bon walking sound pitch", 50, 200)
CreateConVar("bon_sound_pitch_run", "100", FCVAR_ARCHIVE, "Bon running sound pitch", 50, 200)
CreateConVar("bon_sound_pitch_crouch", "100", FCVAR_ARCHIVE, "Bon crawling sound pitch", 50, 200)
CreateConVar("bon_sound_pitch_idle", "100", FCVAR_ARCHIVE, "Bon idle sound pitch", 50, 200)
CreateConVar("bon_sound_pitch_jumpscare", "100", FCVAR_ARCHIVE, "Bon jumpscare sound pitch", 50, 200)

CreateConVar("bon_sight_range", "2000", FCVAR_ARCHIVE, "Bon sight detection range", 100, 10000)
CreateConVar("bon_lose_range", "3000", FCVAR_ARCHIVE, "Bon loses target behind walls at this distance", 100, 15000)
CreateConVar("bon_sound_range", "4000", FCVAR_ARCHIVE, "Maximum distance Bon can detect sounds", 100, 20000)

CreateConVar("bon_ignore_nextbots", "1", FCVAR_ARCHIVE, "Bon ignores other NextBots", 0, 1)
CreateConVar("bon_ignore_npcs", "0", FCVAR_ARCHIVE, "Bon ignores NPCs", 0, 1)
CreateConVar("bon_neckbreak_overlay", "1", FCVAR_ARCHIVE, "Enable neck-break overlay effect during kill camera", 0, 1)
CreateConVar("bon_custom_ai", "1", FCVAR_ARCHIVE, "Enable custom AI (smart sound detection and stalking)", 0, 1)
CreateConVar("bon_sound_investigation_duration", "20", FCVAR_ARCHIVE, "How long Bon investigates a sound source (seconds)", 5, 120)
CreateConVar("bon_stalk_duration", "30", FCVAR_ARCHIVE, "How long Bon stalks after losing sight of enemy (seconds)", 5, 120)
CreateConVar("bon_rage_mode", "0", FCVAR_ARCHIVE, "Rage mode - infinite stalking and chase", 0, 1)

CreateConVar("bon_kill_anim_players", "1", FCVAR_ARCHIVE, "Enable kill animation for players", 0, 1)
CreateConVar("bon_kill_anim_npcs", "1", FCVAR_ARCHIVE, "Enable kill animation for NPCs", 0, 1)
CreateConVar("bon_kill_anim_nextbots", "1", FCVAR_ARCHIVE, "Enable kill animation for NextBots", 0, 1)

CreateConVar("bon_door_open", "1", FCVAR_ARCHIVE, "Bon opens doors normally", 0, 1)
CreateConVar("bon_door_break", "0", FCVAR_ARCHIVE, "Bon breaks doors like a tank", 0, 1)

CreateConVar("bon_ca_camera", "1", FCVAR_ARCHIVE, "Enable CCTV camera on Bon's head", 0, 1)

CreateConVar("bon_break_glass", "1", FCVAR_ARCHIVE, "Bon breaks breakable glass on contact", 0, 1)
CreateConVar("bon_break_props", "1", FCVAR_ARCHIVE, "Bon breaks/destroys props on contact", 0, 1)

CreateConVar("bon_ragdoll_collision", "0", FCVAR_ARCHIVE, "Bon collides with ragdolls (corpses)", 0, 1)


local function ResetBonSettings()
    GetConVar("bon_speed_walk"):SetInt(50)
    GetConVar("bon_speed_run"):SetInt(550)
    GetConVar("bon_speed_crouch"):SetInt(40)
    GetConVar("bon_sound_volume_walk"):SetInt(67)
    GetConVar("bon_sound_volume_run"):SetInt(67)
    GetConVar("bon_sound_volume_crouch"):SetInt(70)
    GetConVar("bon_sound_volume_idle"):SetInt(100)
    GetConVar("bon_sound_volume_jumpscare"):SetInt(100)
    GetConVar("bon_sound_pitch_walk"):SetInt(100)
    GetConVar("bon_sound_pitch_run"):SetInt(100)
    GetConVar("bon_sound_pitch_crouch"):SetInt(100)
    GetConVar("bon_sound_pitch_idle"):SetInt(100)
    GetConVar("bon_sound_pitch_jumpscare"):SetInt(100)
    GetConVar("bon_sight_range"):SetInt(2000)
    GetConVar("bon_lose_range"):SetInt(3000)
    GetConVar("bon_sound_range"):SetInt(4000)
    GetConVar("bon_ignore_nextbots"):SetInt(1)
    GetConVar("bon_ignore_npcs"):SetInt(0)
    GetConVar("bon_neckbreak_overlay"):SetInt(1)
    GetConVar("bon_custom_ai"):SetInt(1)
    GetConVar("bon_sound_investigation_duration"):SetInt(20)
    GetConVar("bon_stalk_duration"):SetInt(30)
    GetConVar("bon_rage_mode"):SetInt(0)
    GetConVar("bon_kill_anim_players"):SetInt(1)
    GetConVar("bon_kill_anim_npcs"):SetInt(1)
    GetConVar("bon_kill_anim_nextbots"):SetInt(1)
    GetConVar("bon_door_open"):SetInt(1)
    GetConVar("bon_door_break"):SetInt(0)
    GetConVar("bon_ca_camera"):SetInt(1)
    GetConVar("bon_break_glass"):SetInt(1)
    GetConVar("bon_break_props"):SetInt(1)
    GetConVar("bon_ragdoll_collision"):SetInt(0)
    print("[BON SETTINGS] All settings reset to defaults")
end

concommand.Add("bon_reset_settings", function(ply)
    if IsValid(ply) and not ply:IsAdmin() then
        ply:PrintMessage(HUD_PRINTCONSOLE, "You must be an admin to reset Bon settings!")
        return
    end
    ResetBonSettings()
    if IsValid(ply) then
        ply:PrintMessage(HUD_PRINTCONSOLE, "[BON SETTINGS] All settings reset to defaults")
    end
end, nil, "Reset all Bon settings to default values")

local function UpdateExistingBons()
    for _, ent in pairs(ents.FindByClass("npc_drgbase_thebonwalten")) do
        if IsValid(ent) then
            ent.DefaultWalkSpeed = GetConVar("bon_speed_walk"):GetInt()
            ent.DefaultRunSpeed = GetConVar("bon_speed_run"):GetInt()
            ent.CrouchSpeed = GetConVar("bon_speed_crouch"):GetInt()
            if not ent:IsCrouching() then
                ent.WalkSpeed = ent.DefaultWalkSpeed
                ent.RunSpeed = ent.DefaultRunSpeed
            else
                ent.WalkSpeed = ent.CrouchSpeed
                ent.RunSpeed = ent.CrouchSpeed
            end
            ent.SightRange = GetConVar("bon_sight_range"):GetInt()
            ent.LoseRange = GetConVar("bon_lose_range"):GetInt()
            ent.SoundRange = GetConVar("bon_sound_range"):GetInt()
            print("[BON DEBUG] Updated existing Bon")
        end
    end
end

cvars.AddChangeCallback("bon_speed_walk", UpdateExistingBons)
cvars.AddChangeCallback("bon_speed_run", UpdateExistingBons) 
cvars.AddChangeCallback("bon_speed_crouch", UpdateExistingBons)
cvars.AddChangeCallback("bon_sight_range", UpdateExistingBons)
cvars.AddChangeCallback("bon_lose_range", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_range", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_volume_walk", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_volume_run", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_volume_crouch", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_volume_idle", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_volume_jumpscare", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_pitch_walk", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_pitch_run", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_pitch_crouch", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_pitch_idle", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_pitch_jumpscare", UpdateExistingBons)
cvars.AddChangeCallback("bon_ignore_nextbots", UpdateExistingBons)
cvars.AddChangeCallback("bon_ignore_npcs", UpdateExistingBons)
cvars.AddChangeCallback("bon_custom_ai", UpdateExistingBons)
cvars.AddChangeCallback("bon_sound_investigation_duration", UpdateExistingBons)
cvars.AddChangeCallback("bon_stalk_duration", UpdateExistingBons)
cvars.AddChangeCallback("bon_rage_mode", UpdateExistingBons)
cvars.AddChangeCallback("bon_kill_anim_players", UpdateExistingBons)
cvars.AddChangeCallback("bon_kill_anim_npcs", UpdateExistingBons)
cvars.AddChangeCallback("bon_kill_anim_nextbots", UpdateExistingBons)
cvars.AddChangeCallback("bon_door_open", UpdateExistingBons)
cvars.AddChangeCallback("bon_door_break", UpdateExistingBons)
cvars.AddChangeCallback("bon_ca_camera", UpdateExistingBons)
cvars.AddChangeCallback("bon_break_glass", UpdateExistingBons)
cvars.AddChangeCallback("bon_break_props", UpdateExistingBons)
cvars.AddChangeCallback("bon_ragdoll_collision", UpdateExistingBons)

print("[BON SETTINGS] Bon settings system loaded successfully!")