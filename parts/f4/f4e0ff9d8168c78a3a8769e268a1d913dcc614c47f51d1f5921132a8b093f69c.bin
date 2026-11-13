surface.CreateFont("bon_header_font", {
    font = "Roboto",
    size = 25,
    weight = 650,
    tall = 15,
    dropshadow = 1,
})


hook.Add("PopulateToolMenu", "BonSettings", function()
    spawnmenu.AddToolMenuOption("Utilities", "Bon The Rabbit", "Bon options", "Bon Settings", "", "", function(panel)
        
        local speedHeader = panel:ControlHelp("SPEED SETTINGS")
        speedHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Walking Speed", Command = "bon_speed_walk", Type = "Int", Min = "1", Max = "500" })
        panel:AddControl("Label", {Text = "Controls how fast Bon walks normally"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Running Speed", Command = "bon_speed_run", Type = "Int", Min = "1", Max = "1000" })
        panel:AddControl("Label", {Text = "Controls how fast Bon runs when chasing"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Crawling Speed", Command = "bon_speed_crouch", Type = "Int", Min = "1", Max = "300" })
        panel:AddControl("Label", {Text = "Controls how fast Bon moves when crawling"})
        panel:AddControl("Label", {Text = ""})
        
        local resetSpeedBtn = panel:Button("Reset Speed Settings")
        resetSpeedBtn.DoClick = function()
            RunConsoleCommand("bon_speed_walk", "50")
            RunConsoleCommand("bon_speed_run", "550")
            RunConsoleCommand("bon_speed_crouch", "40")
            chat.AddText(Color(100, 255, 100), "[BON] Speed settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local detectionHeader = panel:ControlHelp("DETECTION SETTINGS")
        detectionHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Sight Detection Range", Command = "bon_sight_range", Type = "Int", Min = "100", Max = "10000" })
        panel:AddControl("Label", {Text = "How far Bon can see and detect players with direct line of sight"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Wall Lose Target Range", Command = "bon_lose_range", Type = "Int", Min = "100", Max = "15000" })
        panel:AddControl("Label", {Text = "Distance at which Bon loses target behind walls/obstacles"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Sound Detection Range", Command = "bon_sound_range", Type = "Int", Min = "100", Max = "20000" })
        panel:AddControl("Label", {Text = "Maximum distance Bon can detect any sounds (shooting, footsteps, etc.)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetDetectionBtn = panel:Button("Reset Detection Settings")
        resetDetectionBtn.DoClick = function()
            RunConsoleCommand("bon_sight_range", "2000")
            RunConsoleCommand("bon_lose_range", "3000")
            RunConsoleCommand("bon_sound_range", "4000")
            chat.AddText(Color(100, 255, 100), "[BON] Detection settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local behaviorHeader = panel:ControlHelp("BEHAVIOR SETTINGS")
        behaviorHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Ignore other NextBots", Command = "bon_ignore_nextbots" })
        panel:AddControl("Label", {Text = "When enabled, Bon will not target other NextBots (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Ignore NPCs", Command = "bon_ignore_npcs" })
        panel:AddControl("Label", {Text = "When enabled, Bon will not target NPCs (default: OFF)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Neck-break Overlay Effect (Kill Camera)", Command = "bon_neckbreak_overlay" })
        panel:AddControl("Label", {Text = "Enable/disable the screen distortion overlay during kill animation (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Custom AI (Smart Sound Detection & Stalking)", Command = "bon_custom_ai" })
        panel:AddControl("Label", {Text = "When ON: smart sound investigation + stalking. When OFF: standard DrGBase detection (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Sound Investigation Duration (seconds)", Command = "bon_sound_investigation_duration", Type = "Int", Min = "5", Max = "120" })
        panel:AddControl("Label", {Text = "How long Bon searches for the source of a sound before giving up"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Stalking Duration (seconds)", Command = "bon_stalk_duration", Type = "Int", Min = "5", Max = "120" })
        panel:AddControl("Label", {Text = "How long Bon stalks after losing sight of an enemy"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "RAGE MODE (Infinite Stalking & Chase)", Command = "bon_rage_mode" })
        panel:AddControl("Label", {Text = "Bon endlessly runs around searching for targets. Forces Custom AI ON. (default: OFF)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetBehaviorBtn = panel:Button("Reset Behavior Settings")
        resetBehaviorBtn.DoClick = function()
            RunConsoleCommand("bon_ignore_nextbots", "1")
            RunConsoleCommand("bon_ignore_npcs", "0")
            RunConsoleCommand("bon_neckbreak_overlay", "1")
            RunConsoleCommand("bon_custom_ai", "1")
            RunConsoleCommand("bon_sound_investigation_duration", "20")
            RunConsoleCommand("bon_stalk_duration", "30")
            RunConsoleCommand("bon_rage_mode", "0")
            chat.AddText(Color(100, 255, 100), "[BON] Behavior settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local killAnimHeader = panel:ControlHelp("KILL ANIMATION SETTINGS")
        killAnimHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Kill Animation for Players", Command = "bon_kill_anim_players" })
        panel:AddControl("Label", {Text = "Enable/disable the kill animation when killing players (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Kill Animation for NPCs", Command = "bon_kill_anim_npcs" })
        panel:AddControl("Label", {Text = "Enable/disable the kill animation when killing NPCs (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Kill Animation for NextBots", Command = "bon_kill_anim_nextbots" })
        panel:AddControl("Label", {Text = "Enable/disable the kill animation when killing NextBots (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetKillAnimBtn = panel:Button("Reset Kill Animation Settings")
        resetKillAnimBtn.DoClick = function()
            RunConsoleCommand("bon_kill_anim_players", "1")
            RunConsoleCommand("bon_kill_anim_npcs", "1")
            RunConsoleCommand("bon_kill_anim_nextbots", "1")
            chat.AddText(Color(100, 255, 100), "[BON] Kill animation settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local doorHeader = panel:ControlHelp("DOOR INTERACTION SETTINGS")
        doorHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Open Doors (gentle)", Command = "bon_door_open" })
        panel:AddControl("Label", {Text = "Bon opens doors, gates, and other interactable objects normally (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Break Doors (tank mode)", Command = "bon_door_break" })
        panel:AddControl("Label", {Text = "Bon smashes doors into physics props. Overrides Open for breakable doors (default: OFF)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetDoorBtn = panel:Button("Reset Door Settings")
        resetDoorBtn.DoClick = function()
            RunConsoleCommand("bon_door_open", "1")
            RunConsoleCommand("bon_door_break", "0")
            chat.AddText(Color(100, 255, 100), "[BON] Door settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local destructionHeader = panel:ControlHelp("DESTRUCTION SETTINGS")
        destructionHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Break Glass", Command = "bon_break_glass" })
        panel:AddControl("Label", {Text = "Bon smashes breakable glass (func_breakable_surf, func_breakable) on contact (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Break Props", Command = "bon_break_props" })
        panel:AddControl("Label", {Text = "Bon destroys physics props on contact (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "Collide with Ragdolls (corpses)", Command = "bon_ragdoll_collision" })
        panel:AddControl("Label", {Text = "When enabled, Bon collides with ragdolls/corpses. When disabled, Bon walks through them (default: OFF)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetDestructionBtn = panel:Button("Reset Destruction Settings")
        resetDestructionBtn.DoClick = function()
            RunConsoleCommand("bon_break_glass", "1")
            RunConsoleCommand("bon_break_props", "1")
            RunConsoleCommand("bon_ragdoll_collision", "0")
            chat.AddText(Color(100, 255, 100), "[BON] Destruction settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local miscHeader = panel:ControlHelp("CAMERA & MISC SETTINGS")
        miscHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("CheckBox", { Label = "CCTV Camera (ca_camera)", Command = "bon_ca_camera" })
        panel:AddControl("Label", {Text = "Enable/disable the CCTV camera attached to Bon's head (default: ON)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetCameraBtn = panel:Button("Reset Camera Settings")
        resetCameraBtn.DoClick = function()
            RunConsoleCommand("bon_ca_camera", "1")
            chat.AddText(Color(100, 255, 100), "[BON] Camera settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local soundHeader = panel:ControlHelp("SOUND SETTINGS")
        soundHeader:SetFont("bon_header_font")
        panel:AddControl("Label", {Text = ""})
        
        local volumeSubHeader = panel:ControlHelp("Volume Settings")
        volumeSubHeader:SetFont("DermaDefaultBold")
        
        panel:AddControl("Slider", { Label = "Walking Sound Volume", Command = "bon_sound_volume_walk", Type = "Int", Min = "0", Max = "100" })
        panel:AddControl("Label", {Text = "Volume of Bon's walking footsteps"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Running Sound Volume", Command = "bon_sound_volume_run", Type = "Int", Min = "0", Max = "100" })
        panel:AddControl("Label", {Text = "Volume of Bon's running footsteps"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Crawling Sound Volume", Command = "bon_sound_volume_crouch", Type = "Int", Min = "0", Max = "100" })
        panel:AddControl("Label", {Text = "Volume of Bon's crawling sounds"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Idle and Chasing Sound Volume", Command = "bon_sound_volume_idle", Type = "Int", Min = "0", Max = "100" })
        panel:AddControl("Label", {Text = "Volume of Bon's ambient sounds"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Jumpscare Sound Volume", Command = "bon_sound_volume_jumpscare", Type = "Int", Min = "0", Max = "100" })
        panel:AddControl("Label", {Text = "Volume of Bon's jumpscare kill sound"})
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local pitchSubHeader = panel:ControlHelp("Pitch Settings (Higher pitch = funny Bon)")
        pitchSubHeader:SetFont("DermaDefaultBold")
        
        panel:AddControl("Slider", { Label = "Walking Sound Pitch", Command = "bon_sound_pitch_walk", Type = "Int", Min = "50", Max = "200" })
        panel:AddControl("Label", {Text = "Pitch of Bon's walking footsteps (higher = funnier)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Running Sound Pitch", Command = "bon_sound_pitch_run", Type = "Int", Min = "50", Max = "200" })
        panel:AddControl("Label", {Text = "Pitch of Bon's running footsteps (higher = funnier)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Crawling Sound Pitch", Command = "bon_sound_pitch_crouch", Type = "Int", Min = "50", Max = "200" })
        panel:AddControl("Label", {Text = "Pitch of Bon's crawling sounds (higher = funnier)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Idle and Chasing Sound Pitch", Command = "bon_sound_pitch_idle", Type = "Int", Min = "50", Max = "200" })
        panel:AddControl("Label", {Text = "Pitch of Bon's sounds (higher = funnier)"})
        panel:AddControl("Label", {Text = ""})
        
        panel:AddControl("Slider", { Label = "Jumpscare Sound Pitch", Command = "bon_sound_pitch_jumpscare", Type = "Int", Min = "50", Max = "200" })
        panel:AddControl("Label", {Text = "Pitch of Bon's jumpscare sound (higher = funnier)"})
        panel:AddControl("Label", {Text = ""})
        
        local resetSoundBtn = panel:Button("Reset Sound Settings")
        resetSoundBtn.DoClick = function()
            RunConsoleCommand("bon_sound_volume_walk", "67")
            RunConsoleCommand("bon_sound_volume_run", "67")
            RunConsoleCommand("bon_sound_volume_crouch", "70")
            RunConsoleCommand("bon_sound_volume_idle", "100")
            RunConsoleCommand("bon_sound_volume_jumpscare", "100")
            RunConsoleCommand("bon_sound_pitch_walk", "100")
            RunConsoleCommand("bon_sound_pitch_run", "100")
            RunConsoleCommand("bon_sound_pitch_crouch", "100")
            RunConsoleCommand("bon_sound_pitch_idle", "100")
            RunConsoleCommand("bon_sound_pitch_jumpscare", "100")
            chat.AddText(Color(100, 255, 100), "[BON] Sound settings reset to defaults")
        end
        
        panel:AddControl("Label", {Text = ""})
        panel:AddControl("Label", {Text = ""})
        
        local resetAllBtn = panel:Button("Reset ALL Settings to Defaults")
        resetAllBtn.DoClick = function()
            RunConsoleCommand("bon_speed_walk", "50")
            RunConsoleCommand("bon_speed_run", "550")
            RunConsoleCommand("bon_speed_crouch", "40")
            RunConsoleCommand("bon_sound_volume_walk", "67")
            RunConsoleCommand("bon_sound_volume_run", "67")
            RunConsoleCommand("bon_sound_volume_crouch", "70")
            RunConsoleCommand("bon_sound_volume_idle", "100")
            RunConsoleCommand("bon_sound_volume_jumpscare", "100")
            RunConsoleCommand("bon_sound_pitch_walk", "100")
            RunConsoleCommand("bon_sound_pitch_run", "100")
            RunConsoleCommand("bon_sound_pitch_crouch", "100")
            RunConsoleCommand("bon_sound_pitch_idle", "100")
            RunConsoleCommand("bon_sound_pitch_jumpscare", "100")
            RunConsoleCommand("bon_sight_range", "2000")
            RunConsoleCommand("bon_lose_range", "3000")
            RunConsoleCommand("bon_sound_range", "4000")
            RunConsoleCommand("bon_ignore_nextbots", "1")
            RunConsoleCommand("bon_ignore_npcs", "0")
            RunConsoleCommand("bon_neckbreak_overlay", "1")
            RunConsoleCommand("bon_custom_ai", "1")
            RunConsoleCommand("bon_sound_investigation_duration", "20")
            RunConsoleCommand("bon_stalk_duration", "30")
            RunConsoleCommand("bon_rage_mode", "0")
            RunConsoleCommand("bon_kill_anim_players", "1")
            RunConsoleCommand("bon_kill_anim_npcs", "1")
            RunConsoleCommand("bon_kill_anim_nextbots", "1")
            RunConsoleCommand("bon_door_open", "1")
            RunConsoleCommand("bon_door_break", "0")
            RunConsoleCommand("bon_ca_camera", "1")
            RunConsoleCommand("bon_break_glass", "1")
            RunConsoleCommand("bon_break_props", "1")
            RunConsoleCommand("bon_ragdoll_collision", "0")
            chat.AddText(Color(255, 100, 100), "[BON] ALL settings reset to defaults!")
        end
        
    end)
end)