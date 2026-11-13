if not DrGBase then return end
ENT.Base = "drgbase_nextbot"


ENT.PrintName = "Bon (Walten Files)"
ENT.Category = "[DRGBASE] Walten Files Nextbots"
ENT.Models = {"models/gentoi/walterfiles/bon.mdl"}
ENT.ModelScale = 1.0
ENT.BloodColor = BLOOD_COLOR_MECH
ENT.CollisionBounds = Vector(10, 10, 72)
ENT.CrouchCollisionBounds = Vector(10, 10, 36)


ENT.OnDamageSounds = {}
ENT.OnDeathSounds = {}
ENT.OnIdleSounds = {}


ENT.SpawnHealth = 2000


ENT.RangeAttackRange = 0
ENT.MeleeAttackRange = 75
ENT.ReachEnemyRange = 0
ENT.AvoidEnemyRange = 0


ENT.Factions = {"FACTION_WALTENFILES"}


ENT.RunAnimation = "run"
ENT.IdleAnimation = "idle"
ENT.WalkAnimation = "walk"

ENT.CrouchAnimation = "Crouch"
ENT.CrouchWalkAnimation = "CrawlMovement"

ENT.DefaultRunAnimation = "run"
ENT.DefaultIdleAnimation = "idle"
ENT.DefaultWalkAnimation = "walk"

ENT.DeathAnimation = "kill"

ENT.WalkSpeed = 50
ENT.RunSpeed = 550

ENT.CrouchSpeed = 40

ENT.DefaultWalkSpeed = 50
ENT.DefaultRunSpeed = 550

ENT.JumpAnimation = "run"


ENT.EyeBone = "Head"
ENT.EyeOffset = Vector(7.5, 0, 0)


ENT.PossessionEnabled = true
ENT.PossessionMovement = POSSESSION_MOVE_8DIR
ENT.PossessionViews = {
  {
    offset = Vector(0, 30, 75),
    distance = 125,
  },
  {
    offset = Vector(25, 0, 0),
    eyepos = true
  }
}

ENT.PossessionBinds = {
  [IN_ATTACK] = {{
    coroutine = true,
    onkeydown = function(self)
      local enemy = self:GetClosestEnemy()
      if enemy != nil and enemy != null and IsValid(enemy) and IsValid(self) then
        
        if enemy:GetClass() == "info_target" and 
           string.find(enemy:GetName() or "", "BonSoundTarget_") then
          print("[BON DEBUG] Prevented possession attack on sound target")
          return
        end
        
        if self.InvestigatingSound then
          print("[BON DEBUG] Prevented possession attack during sound investigation")
          return
        end
        
        if !self:IsInRange(enemy:GetPos(), 75) then return end
        if enemy:IsPlayer() and self.GrabbedEntity == nil then
          self.IsKilling = true
          self:StopAllBonSounds()
          
          local usePlayerAnim = GetConVar("bon_kill_anim_players"):GetBool()
          
          self:TeleportVictimInFront(enemy)
          
          if usePlayerAnim then
            self:NextbotNextbotJumpscarePlayer(enemy, function()
              local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
              local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
              self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
            end, function()
              self.IsKilling = false
              self:ResetSoundSystem()
              self:ForceUnCrouch()
            end)
          else
            local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
            local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
            self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
            self:StopKillEnforcement(enemy)
            enemy:TakeDamage(math.huge, self, self)
            self:StopRagdollVelocity(enemy)
            self.IsKilling = false
            self:ResetSoundSystem()
            self:ForceUnCrouch()
          end
        end
        if !enemy:IsPlayer() then
          self:KillNPC(enemy)
        end
      end
    end
  }},
  [IN_ATTACK2] = {{
    coroutine = true,
    onkeypressed = function(self)
    end
  }},
  [IN_JUMP] = {{
    coroutine = false,
    onkeydown = function(self)
      self:Jump(50)
    end
  }},
  [IN_DUCK] = {{
    coroutine = false,
    onkeypressed = function(self)
      if self:IsCrouching() then
        self:UnCrouch()
      else
        self:ToCrouch()
      end
    end
  }}
}

if SERVER then

  
  
  
  function ENT:FaceVictimTowardsBon(victim)
    if not IsValid(victim) or not IsValid(self) then return end
    
    local dirToBon = (self:GetPos() - victim:GetPos())
    dirToBon.z = 0
    local facingAngle = dirToBon:Angle()
    facingAngle.p = 0
    facingAngle.r = 0
    
    if victim:IsPlayer() then
      victim:SetEyeAngles(facingAngle)
    else
      victim:SetAngles(facingAngle)
    end
  end

  
  
  
  
  
  
  function ENT:TeleportVictimInFront(victim)
    if not IsValid(victim) or not IsValid(self) then return end
    
    
    local teleportPos = self:GetPos() + self:GetForward() * 65
    
    if victim:IsPlayer() then
      
      if not victim._bonOrigMoveType then
        victim._bonOrigMoveType = victim:GetMoveType()
      end
      victim:SetPos(teleportPos)
      victim:SetLocalVelocity(Vector(0, 0, 0))
      
      victim:SetMoveType(MOVETYPE_NONE)
      
      victim:Freeze(true)
      
      victim:SetNWBool("BonLockView", true)
      victim:SetNWEntity("BonLockViewEntity", self)
      
      net.Start("bon_lock_player_view")
      net.WriteBool(true)
      net.WriteEntity(self)
      net.Send(victim)
    elseif victim:IsNPC() then
      if not victim._bonOrigMoveType then
        victim._bonOrigMoveType = victim:GetMoveType()
      end
      if victim.SetSaveValue then
        victim:SetSaveValue("m_vecAbsOrigin", teleportPos)
      end
      victim:SetPos(teleportPos)
      victim:SetMoveType(MOVETYPE_NOCLIP)
    elseif victim:IsNextBot() then
      if not victim._bonOrigMoveType then
        victim._bonOrigMoveType = victim:GetMoveType()
      end
      if not victim._bonOrigSolid then
        victim._bonOrigSolid = victim:GetSolid()
      end
      if victim.loco then
        if victim.loco.SetVelocity then victim.loco:SetVelocity(Vector(0, 0, 0)) end
      end
      victim:SetPos(teleportPos)
      victim:SetMoveType(MOVETYPE_NONE)
      victim:SetSolid(SOLID_NONE)
      victim:AddFlags(FL_NOTARGET)
    else
      victim:SetPos(teleportPos)
    end
    
    
    self:FaceVictimTowardsBon(victim)
    
    
    if not victim:IsPlayer() then
      self:FreezeVictim(victim)
    end
    
    
    self:StartKillEnforcement(victim)
  end

  
  
  
  
  
  
  
  function ENT:StartKillEnforcement(victim)
    if not IsValid(victim) or not IsValid(self) then return end
    
    local hookName = "BonKillEnforce_" .. self:EntIndex() .. "_" .. victim:EntIndex()
    local LERP_FACTOR = 0.25      
    local SNAP_DISTANCE = 1       
    local MAX_DISTANCE = 300      
    local NPC_SMOOTH_SPEED = 800  
    
    
    hook.Remove("Think", hookName)
    
    hook.Add("Think", hookName, function()
      
      if not IsValid(self) or not IsValid(victim) or not self.IsKilling then
        hook.Remove("Think", hookName)
        
        
        if IsValid(victim) then
          if victim:IsPlayer() then
            victim:Freeze(false)
            if victim._bonOrigMoveType then
              victim:SetMoveType(victim._bonOrigMoveType)
              victim._bonOrigMoveType = nil
            end
            victim:SetLocalVelocity(Vector(0, 0, 0))
            victim:SetNWBool("BonLockView", false)
            victim:SetNWEntity("BonLockViewEntity", NULL)
            net.Start("bon_lock_player_view")
            net.WriteBool(false)
            net.WriteEntity(victim)
            net.Send(victim)
          else
            if IsValid(self) then
              self:UnfreezeNPC(victim)
            else
              if victim._bonOrigMoveType then
                victim:SetMoveType(victim._bonOrigMoveType)
                victim._bonOrigMoveType = nil
              else
                victim:SetMoveType(MOVETYPE_STEP)
              end
              
              if victim:IsNextBot() then
                if victim._bonOrigSolid then
                  victim:SetSolid(victim._bonOrigSolid)
                  victim._bonOrigSolid = nil
                else
                  victim:SetSolid(SOLID_BBOX)
                end
                victim:RemoveFlags(FL_NOTARGET)
              end
              if victim:IsNPC() then
                victim:SetNPCState(NPC_STATE_IDLE)
              end
            end
          end
        end
        return
      end
      
      if victim:Health() <= 0 then
        hook.Remove("Think", hookName)
        
        if victim:IsPlayer() and victim._bonOrigMoveType then
          victim._bonOrigMoveType = nil  
        end
        return
      end
      
      
      local targetPos = self:GetPos() + self:GetForward() * 65
      local currentPos = victim:GetPos()
      local delta = targetPos - currentPos
      local distance = delta:Length()
      
      if victim:IsPlayer() then
        
        
        
        
        
        
        
        
        
        if victim:GetMoveType() != MOVETYPE_NONE then
          victim:SetMoveType(MOVETYPE_NONE)
        end
        
        if distance > MAX_DISTANCE then
          
          victim:SetPos(targetPos)
        elseif distance > SNAP_DISTANCE then
          
          local newPos = LerpVector(LERP_FACTOR, currentPos, targetPos)
          victim:SetPos(newPos)
        else
          
          victim:SetPos(targetPos)
        end
        
        
        local dirToBon = (self:GetPos() - victim:GetPos())
        dirToBon.z = 0
        local facingAngle = dirToBon:Angle()
        facingAngle.p = 0
        facingAngle.r = 0
        victim:SetEyeAngles(facingAngle)
        
      elseif victim:IsNPC() then
        
        
        
        if victim:GetMoveType() != MOVETYPE_NOCLIP then
          victim:SetMoveType(MOVETYPE_NOCLIP)
        end
        
        if distance > MAX_DISTANCE then
          victim:SetPos(targetPos)
          victim:SetLocalVelocity(Vector(0, 0, 0))
        elseif distance > SNAP_DISTANCE then
          local moveDir = delta:GetNormalized()
          local speed = math.min(NPC_SMOOTH_SPEED, distance / engine.TickInterval())
          victim:SetLocalVelocity(moveDir * speed)
        else
          victim:SetLocalVelocity(Vector(0, 0, 0))
        end
        
        victim:SetSchedule(SCHED_NONE)
        victim:SetNPCState(NPC_STATE_SCRIPT)
        if victim.StopMoving then victim:StopMoving() end
        
      elseif victim:IsNextBot() then
        
        
        
        
        
        victim:SetMoveType(MOVETYPE_NONE)
        victim:SetSolid(SOLID_NONE)
        victim:AddFlags(FL_NOTARGET)
        
        if victim.loco then
          if victim.loco.SetVelocity then victim.loco:SetVelocity(Vector(0, 0, 0)) end
          if victim.loco.SetDesiredSpeed then victim.loco:SetDesiredSpeed(0) end
        end
        victim:SetLocalVelocity(Vector(0, 0, 0))
        
        
        if victim.SetSchedule then victim:SetSchedule(SCHED_NONE) end
        if victim.SetEnemy then victim:SetEnemy(NULL) end
        if victim.StopMoving then victim:StopMoving() end
        
        
        if distance > MAX_DISTANCE then
          victim:SetPos(targetPos)
        elseif distance > SNAP_DISTANCE then
          local newPos = LerpVector(LERP_FACTOR, currentPos, targetPos)
          victim:SetPos(newPos)
        else
          victim:SetPos(targetPos)
        end
      end
      
      
      if not victim:IsPlayer() then
        self:FaceVictimTowardsBon(victim)
      end
    end)
  end

  
  
  
  
  
  
  function ENT:StopRagdollVelocity(victim)
    if not IsValid(self) then return end
    
    local victimPos = nil
    if IsValid(victim) then
      victimPos = victim:GetPos()
    else
      victimPos = self:GetPos() + self:GetForward() * 65
    end
    
    
    
    local function SoftZeroRagdollVelocity(searchPos, isFirst)
      for _, ent in pairs(ents.FindInSphere(searchPos, 150)) do
        if IsValid(ent) and ent:GetClass() == "prop_ragdoll" then
          
          local phys = ent:GetPhysicsObject()
          if IsValid(phys) then
            
            phys:SetVelocity(Vector(0, 0, -10))
            phys:SetAngleVelocity(Vector(0, 0, 0))
            
            phys:Wake()
          end
          
          for i = 0, ent:GetPhysicsObjectCount() - 1 do
            local bone = ent:GetPhysicsObjectNum(i)
            if IsValid(bone) then
              bone:SetVelocity(Vector(0, 0, -10))
              bone:SetAngleVelocity(Vector(0, 0, 0))
              bone:Wake()
            end
          end
        end
      end
    end
    
    
    SoftZeroRagdollVelocity(victimPos, true)
    
    
    
    for _, delay in ipairs({0, 0.01, 0.02, 0.03, 0.05}) do
      timer.Simple(delay, function()
        SoftZeroRagdollVelocity(victimPos, false)
      end)
    end
  end

  
  
  
  function ENT:StopKillEnforcement(victim)
    if not IsValid(victim) then return end
    local hookName = "BonKillEnforce_" .. self:EntIndex() .. "_" .. victim:EntIndex()
    hook.Remove("Think", hookName)
    
    
    if victim:IsPlayer() then
      victim:Freeze(false)
      
      if victim._bonOrigMoveType then
        victim:SetMoveType(victim._bonOrigMoveType)
        victim._bonOrigMoveType = nil
      end
      victim:SetLocalVelocity(Vector(0, 0, 0))
      victim:SetNWBool("BonLockView", false)
      victim:SetNWEntity("BonLockViewEntity", NULL)
      net.Start("bon_lock_player_view")
      net.WriteBool(false)
      net.WriteEntity(victim)
      net.Send(victim)
    end
  end

  
  
  
  
  
  function ENT:FreezeVictim(victim)
    if not IsValid(victim) then return end
    
    if victim:IsPlayer() then
      
      return
    end
    
    
    if not victim._bonOrigMoveType then
      victim._bonOrigMoveType = victim:GetMoveType()
    end
    
    if victim:IsNPC() then
      victim:SetSchedule(SCHED_NONE)
      if victim.ClearSchedule then victim:ClearSchedule() end
      if victim.ClearGoal then victim:ClearGoal() end
      if victim.StopMoving then victim:StopMoving() end
      victim:SetNPCState(NPC_STATE_SCRIPT)
      victim:SetMoveType(MOVETYPE_NOCLIP)
      
      local idleSeq = victim:LookupSequence("idle")
      if not idleSeq or idleSeq <= 0 then
        idleSeq = victim:LookupSequence("Idle")
      end
      if not idleSeq or idleSeq <= 0 then
        idleSeq = victim:SelectWeightedSequence(ACT_IDLE)
      end
      if idleSeq and idleSeq > 0 then
        victim:SetSequence(idleSeq)
        victim:SetCycle(0)
        victim:ResetSequenceInfo()
      end
      
    elseif victim:IsNextBot() then
      if victim.loco then
        if victim.loco.SetVelocity then victim.loco:SetVelocity(Vector(0, 0, 0)) end
        if victim.loco.SetDesiredSpeed then victim.loco:SetDesiredSpeed(0) end
      end
      victim:SetMoveType(MOVETYPE_NONE)
      victim:SetSolid(SOLID_NONE)
      victim:AddFlags(FL_NOTARGET)
      victim:SetLocalVelocity(Vector(0, 0, 0))
      if victim.SetSchedule then victim:SetSchedule(SCHED_NONE) end
      if victim.SetEnemy then victim:SetEnemy(NULL) end
      
      local idleSeq = victim:LookupSequence("idle")
      if not idleSeq or idleSeq <= 0 then
        idleSeq = victim:LookupSequence("Idle")
      end
      if not idleSeq or idleSeq <= 0 then
        idleSeq = victim:SelectWeightedSequence(ACT_IDLE)
      end
      if idleSeq and idleSeq > 0 then
        victim:SetSequence(idleSeq)
        victim:SetCycle(0)
        victim:ResetSequenceInfo()
      end
    end
  end

  
  
  
  function ENT:UnfreezeNPC(npc)
    if not IsValid(npc) then return end
    
    
    if IsValid(self) then
      self:StopKillEnforcement(npc)
    end
    
    
    npc._bonFreezePos = nil
    npc._bonFreezeAngles = nil
    npc._bonOwner = nil
    
    
    if npc._bonOrigMoveType then
      npc:SetMoveType(npc._bonOrigMoveType)
      npc._bonOrigMoveType = nil
    else
      if npc:IsNPC() then
        npc:SetMoveType(MOVETYPE_STEP)
      elseif npc:IsNextBot() then
        npc:SetMoveType(MOVETYPE_STEP)
      end
    end
    
    
    if npc:IsNPC() then
      npc:SetNPCState(NPC_STATE_IDLE)
    elseif npc:IsNextBot() then
      
      if npc._bonOrigSolid then
        npc:SetSolid(npc._bonOrigSolid)
        npc._bonOrigSolid = nil
      else
        npc:SetSolid(SOLID_BBOX)
      end
      npc:RemoveFlags(FL_NOTARGET)
      if npc.loco and npc.loco.SetDesiredSpeed then
        npc.loco:SetDesiredSpeed(200)
      end
    end
    
    timer.Simple(0.3, function()
      if IsValid(npc) then
        if npc:IsNPC() then
          npc:SetNPCState(NPC_STATE_IDLE)
          if npc._bonOrigMoveType then
            npc:SetMoveType(npc._bonOrigMoveType)
            npc._bonOrigMoveType = nil
          end
        elseif npc:IsNextBot() then
          if npc.loco and npc.loco.SetDesiredSpeed then
            npc.loco:SetDesiredSpeed(200)
          end
          if npc._bonOrigMoveType then
            npc:SetMoveType(npc._bonOrigMoveType)
            npc._bonOrigMoveType = nil
          end
          
          if npc._bonOrigSolid then
            npc:SetSolid(npc._bonOrigSolid)
            npc._bonOrigSolid = nil
          end
          npc:RemoveFlags(FL_NOTARGET)
        end
      end
    end)
  end

  
  
  
  function ENT:ShouldIgnoreTarget(ent)
    if not IsValid(ent) then return true end
    
    if ent:IsNextBot() and ent != self then
      if GetConVar("bon_ignore_nextbots"):GetBool() then
        return true
      end
    end
    
    if ent:IsNPC() then
      if GetConVar("bon_ignore_npcs"):GetBool() then
        return true
      end
    end
    
    return false
  end

  
  
  
  
  function ENT:IsCustomAIEnabled()
    if GetConVar("bon_rage_mode") and GetConVar("bon_rage_mode"):GetBool() then
      return true
    end
    return GetConVar("bon_custom_ai") and GetConVar("bon_custom_ai"):GetBool()
  end


  function ENT:UpdateSpeedsFromConVars()
    if not GetConVar("bon_speed_walk") then
      print("[BON DEBUG] ConVars not loaded yet, using default speeds")
      return
    end
    
    self.DefaultWalkSpeed = GetConVar("bon_speed_walk"):GetInt()
    self.DefaultRunSpeed = GetConVar("bon_speed_run"):GetInt()
    self.CrouchSpeed = GetConVar("bon_speed_crouch"):GetInt()
    
    if not self:IsCrouching() and not self.IsLookingAround then
      self.WalkSpeed = self.DefaultWalkSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
    
    local newSightRange = GetConVar("bon_sight_range") and GetConVar("bon_sight_range"):GetInt() or 2000
    if self.SightRange != newSightRange then
      self.SightRange = newSightRange
    end
    
    local newLoseRange = GetConVar("bon_lose_range") and GetConVar("bon_lose_range"):GetInt() or 3000
    if self.LoseRange != newLoseRange then
      self.LoseRange = newLoseRange
    end
    
    local newSoundRange = GetConVar("bon_sound_range") and GetConVar("bon_sound_range"):GetInt() or 4000
    if self.SoundRange != newSoundRange then
      self.SoundRange = newSoundRange
    end
    
    self.SoundVolumes = {
      walk = GetConVar("bon_sound_volume_walk") and GetConVar("bon_sound_volume_walk"):GetInt() or 67,
      run = GetConVar("bon_sound_volume_run") and GetConVar("bon_sound_volume_run"):GetInt() or 67,
      crouch = GetConVar("bon_sound_volume_crouch") and GetConVar("bon_sound_volume_crouch"):GetInt() or 70,
      idle = GetConVar("bon_sound_volume_idle") and GetConVar("bon_sound_volume_idle"):GetInt() or 100,
      jumpscare = GetConVar("bon_sound_volume_jumpscare") and GetConVar("bon_sound_volume_jumpscare"):GetInt() or 100
    }
    
    self.SoundPitches = {
      walk = GetConVar("bon_sound_pitch_walk") and GetConVar("bon_sound_pitch_walk"):GetInt() or 100,
      run = GetConVar("bon_sound_pitch_run") and GetConVar("bon_sound_pitch_run"):GetInt() or 100,
      crouch = GetConVar("bon_sound_pitch_crouch") and GetConVar("bon_sound_pitch_crouch"):GetInt() or 100,
      idle = GetConVar("bon_sound_pitch_idle") and GetConVar("bon_sound_pitch_idle"):GetInt() or 100,
      jumpscare = GetConVar("bon_sound_pitch_jumpscare") and GetConVar("bon_sound_pitch_jumpscare"):GetInt() or 100
    }
  end


  function ENT:ShouldLoseTargetBehindWalls()
    if not self:HasEnemy() then return false end
    local enemy = self:GetEnemy()
    if not IsValid(enemy) then return false end
    
    if enemy:GetClass() == "info_target" then
      local eName = enemy:GetName() or ""
      if string.find(eName, "BonSoundTarget_") or string.find(eName, "BonStalkTarget_") then
        return false
      end
    end
    
    local distance = self:GetPos():Distance(enemy:GetPos())
    local maxLoseRange = self.LoseRange or 3000
    local hasDirectSight = self:IsInSight(enemy)
    
    if not hasDirectSight and distance > maxLoseRange then
      return true
    end
    
    if hasDirectSight and distance > self.SightRange then
      return true
    end
    
    return false
  end


  function ENT:HasDirectLineOfSight(ent)
    if not IsValid(self) or not IsValid(ent) then return false end
    
    local startPos = self:EyePos()
    local endPos = ent:GetPos()
    if ent.EyePos then endPos = ent:EyePos() end
    
    local trace = util.TraceLine({
      start = startPos,
      endpos = endPos,
      filter = self,
      mask = MASK_SOLID_BRUSHONLY
    })
    
    return not trace.Hit
  end

  function ENT:IsEnemyOnDifferentElevation()
    if not self:HasEnemy() then return false end
    local enemy = self:GetEnemy()
    if not IsValid(enemy) then return false end
    
    if enemy:GetClass() == "info_target" then return false end
    
    local myPos = self:GetPos()
    local enemyPos = enemy:GetPos()
    local heightDiff = math.abs(enemyPos.z - myPos.z)
    local horizontalDist = Vector(enemyPos.x - myPos.x, enemyPos.y - myPos.y, 0):Length()
    
    if heightDiff > 60 and horizontalDist < (self.SightRange or 2000) then
      if self:HasDirectLineOfSight(enemy) or self:IsInSight(enemy) then
        return true
      end
    end
    
    return false
  end

  
  
  
  function ENT:StartStalking(lastKnownPos)
    if not IsValid(self) then return end
    if self.IsStalking then return end
    if self.IsKilling then return end
    
    if not self:IsCustomAIEnabled() then return end
    
    print("[BON DEBUG] === STALKING STARTED === Last known pos: " .. tostring(lastKnownPos))
    
    self.IsStalking = true
    self.StalkStartTime = CurTime()
    self.StalkLastKnownPos = lastKnownPos
    self.StalkSearchIndex = 0
    self.StalkSearchRadius = 1000
    self.StalkCurrentTarget = nil
    self.StalkReachedFirstTarget = false
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultRunSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
    
    self:SetStalkTarget(lastKnownPos)
  end
  
  function ENT:SetStalkTarget(targetPos)
    if not IsValid(self) or not self.IsStalking then return end
    
    self.StalkSearchIndex = self.StalkSearchIndex + 1
    
    if IsValid(self.StalkTargetEnt) then
      self.StalkTargetEnt:Remove()
    end
    
    local stalkTarget = ents.Create("info_target")
    if IsValid(stalkTarget) then
      stalkTarget:SetPos(targetPos)
      stalkTarget:Spawn()
      stalkTarget:SetName("BonStalkTarget_" .. self:EntIndex())
      
      self:AddEntityRelationship(stalkTarget, D_HT, 99)
      self:SetEnemy(stalkTarget)
      
      self.StalkTargetEnt = stalkTarget
      self.StalkCurrentTarget = targetPos
      
      print("[BON DEBUG] Stalk search #" .. self.StalkSearchIndex .. " - heading to " .. tostring(targetPos))
    end
  end
  
  function ENT:PickNextStalkTarget()
    if not IsValid(self) or not self.IsStalking then return end
    
    local myPos = self:GetPos()
    local forward = self:GetForward()
    local right = self:GetRight()
    
    local fovHalfAngle = 70
    local bestTarget = nil
    
    for i = 1, 12 do
      local randomAngle = math.Rand(-fovHalfAngle, fovHalfAngle)
      local randomDist = math.Rand(300, self.StalkSearchRadius)
      
      local searchDir = forward * math.cos(math.rad(randomAngle)) + right * math.sin(math.rad(randomAngle))
      searchDir:Normalize()
      
      local searchPos = myPos + searchDir * randomDist
      
      if navmesh.IsLoaded() then
        local navArea = navmesh.GetNearestNavArea(searchPos, 500)
        if navArea then
          local navPos = navArea:GetCenter()
          local toNav = (navPos - myPos):GetNormalized()
          local navDot = forward:Dot(toNav)
          
          if navDot > 0.1 then
            bestTarget = navPos
            break
          end
        end
      else
        local trace = util.TraceLine({
          start = myPos,
          endpos = searchPos,
          filter = self,
          mask = MASK_SOLID_BRUSHONLY
        })
        
        if trace.Fraction > 0.3 then
          bestTarget = trace.HitPos - searchDir * 30
          break
        end
      end
    end
    
    if not bestTarget then
      bestTarget = myPos + forward * 400
      print("[BON DEBUG] Stalk - no valid target, going forward")
    end
    
    self:SetStalkTarget(bestTarget)
  end
  
  function ENT:UpdateStalking()
    if not IsValid(self) or not self.IsStalking then return end
    
    local isRageMode = GetConVar("bon_rage_mode") and GetConVar("bon_rage_mode"):GetBool()
    
    if not isRageMode then
      local stalkDuration = GetConVar("bon_stalk_duration") and GetConVar("bon_stalk_duration"):GetInt() or 30
      
      if CurTime() - self.StalkStartTime > stalkDuration then
        print("[BON DEBUG] Stalking timeout after " .. stalkDuration .. "s, giving up")
        self:StopStalking()
        return
      end
    end
    
    if IsValid(self.StalkTargetEnt) then
      if not self:HasEnemy() or self:GetEnemy() != self.StalkTargetEnt then
        self:AddEntityRelationship(self.StalkTargetEnt, D_HT, 99)
        self:SetEnemy(self.StalkTargetEnt)
      end
    end
    
    for _, ent in pairs(ents.FindInSphere(self:GetPos(), self.SightRange)) do
      if IsValid(ent) and (ent:IsPlayer() or ent:IsNPC() or ent:IsNextBot()) and ent != self then
        if self:ShouldIgnoreTarget(ent) then continue end
        if ent:IsPlayer() and ent:Team() == TEAM_SPECTATOR then continue end
        if ent:Health() > 0 and self:IsInSight(ent) and self:HasDirectLineOfSight(ent) then
          print("[BON DEBUG] STALKING: Found target! " .. tostring(ent))
          self:StopStalking()
          self:AddEntityRelationship(ent, D_HT, 99)
          self:SetEnemy(ent)
          return
        end
      end
    end
    
    if self.StalkCurrentTarget then
      local dist = self:GetPos():Distance(self.StalkCurrentTarget)
      if dist < 150 then
        print("[BON DEBUG] Reached stalk point #" .. self.StalkSearchIndex .. ", picking next")
        self:PickNextStalkTarget()
      end
    end
    
    if not IsValid(self.StalkTargetEnt) and self.StalkCurrentTarget then
      self:SetStalkTarget(self.StalkCurrentTarget)
    end
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultRunSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
  end
  
  function ENT:StopStalking()
    if not IsValid(self) then return end
    
    print("[BON DEBUG] === STALKING STOPPED ===")
    self.IsStalking = false
    self.StalkStartTime = nil
    self.StalkLastKnownPos = nil
    self.StalkSearchIndex = 0
    self.StalkCurrentTarget = nil
    
    if IsValid(self.StalkTargetEnt) then
      if self:HasEnemy() and self:GetEnemy() == self.StalkTargetEnt then
        self:SetEnemy(NULL)
      end
      self.StalkTargetEnt:Remove()
      self.StalkTargetEnt = nil
    end
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultWalkSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
  end


  
  
  
  function ENT:OnSound(soundData)
    if GetConVar("ai_disabled"):GetBool() then return end
    if GetConVar("ai_ignoreplayers"):GetBool() then return end
    if not IsValid(self) or not soundData then return end
    
    if not self:IsCustomAIEnabled() then
      if self.BaseClass and self.BaseClass.OnSound then
        self.BaseClass.OnSound(self, soundData)
      end
      return
    end
    
    local sourcePos = nil
    
    if soundData.Pos then
      sourcePos = soundData.Pos
    elseif soundData.pos then
      sourcePos = soundData.pos  
    elseif soundData.Origin then
      sourcePos = soundData.Origin
    elseif soundData.origin then
      sourcePos = soundData.origin
    elseif soundData.Entity and IsValid(soundData.Entity) then
      sourcePos = soundData.Entity:GetPos()
    elseif soundData.GetPos and type(soundData.GetPos) == "function" then
      sourcePos = soundData:GetPos()
    end
    
    if not sourcePos then return end
    
    local distance = self:GetPos():Distance(sourcePos)
    if not self:CanDetectSounds(sourcePos) then return end
    
    if self.IsStalking then
      print("[BON DEBUG] OnSound: Sound during stalking, redirecting")
      self.StalkLastKnownPos = sourcePos
      self:SetStalkTarget(sourcePos)
      return
    end
    
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      local currentEnemy = self:GetEnemy()
      local eName = currentEnemy:GetName() or ""
      
      if currentEnemy:GetClass() != "info_target" or not string.find(eName, "BonSoundTarget_") then
        return
      else
        self:ResetSoundInvestigation()
      end
    end
    
    if self.InvestigatingSound or self.IsLookingAround then
      self:ResetSoundInvestigation()
    end
    
    print("[BON DEBUG] OnSound: Investigating sound at " .. tostring(sourcePos) .. " dist=" .. math.Round(distance))
    self.InvestigatingSound = true
    self.SoundInvestigationComplete = false
    self.SoundTargetPos = sourcePos
    self.SoundInvestigationStartTime = CurTime()
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultRunSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
    
    if IsValid(self.SoundTarget) then
      self.SoundTarget:Remove()
    end
    
    local soundTarget = ents.Create("info_target")
    if IsValid(soundTarget) then
      soundTarget:SetPos(sourcePos)
      soundTarget:Spawn()
      soundTarget:SetName("BonSoundTarget_" .. self:EntIndex())
      
      self:AddEntityRelationship(soundTarget, D_HT, 99)
      self:SetEnemy(soundTarget)
      self.SoundTarget = soundTarget
      
      print("[BON DEBUG] Sound target created")
    else
      self:ResetSoundInvestigation()
    end
  end

  function ENT:UpdateSoundInvestigation()
    if not IsValid(self) or not self.InvestigatingSound then return end
    if self.SoundInvestigationComplete then return end
    if self.IsLookingAround then return end
    
    local soundDuration = GetConVar("bon_sound_investigation_duration") and GetConVar("bon_sound_investigation_duration"):GetInt() or 20
    
    if self.SoundInvestigationStartTime and CurTime() - self.SoundInvestigationStartTime > soundDuration then
      print("[BON DEBUG] Sound chase timeout after " .. soundDuration .. "s")
      self:ResetSoundInvestigation()
      return
    end
    
    if IsValid(self.SoundTarget) then
      if not self:HasEnemy() or self:GetEnemy() != self.SoundTarget then
        self:AddEntityRelationship(self.SoundTarget, D_HT, 99)
        self:SetEnemy(self.SoundTarget)
      end
    else
      if self.SoundTargetPos then
        local soundTarget = ents.Create("info_target")
        if IsValid(soundTarget) then
          soundTarget:SetPos(self.SoundTargetPos)
          soundTarget:Spawn()
          soundTarget:SetName("BonSoundTarget_" .. self:EntIndex())
          self:AddEntityRelationship(soundTarget, D_HT, 99)
          self:SetEnemy(soundTarget)
          self.SoundTarget = soundTarget
        else
          self:ResetSoundInvestigation()
          return
        end
      else
        self:ResetSoundInvestigation()
        return
      end
    end
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultRunSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
    
    if IsValid(self.SoundTarget) then
      local distanceToTarget = self:GetPos():Distance(self.SoundTarget:GetPos())
      
      if distanceToTarget <= 150 then
        print("[BON DEBUG] Arrived at sound location")
        local savedPos = self.SoundTargetPos
        
        self:SetEnemy(NULL)
        self.SoundTarget:Remove()
        self.SoundTarget = nil
        
        self:InvestigateLocation(savedPos)
      end
    end
  end

  function ENT:InvestigateLocation(pos)
    if not IsValid(self) then return end
    if self.SoundInvestigationComplete then return end
    
    self.SoundInvestigationComplete = true
    print("[BON DEBUG] Investigating sound location - starting look around")
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultWalkSpeed
      self.RunSpeed = self.DefaultRunSpeed
    end
    
    local foundEnemy = false
    
    for _, ent in pairs(ents.FindInSphere(pos, 300)) do
      if IsValid(ent) and (ent:IsPlayer() or ent:IsNPC() or ent:IsNextBot()) and ent != self then
        if self:ShouldIgnoreTarget(ent) then continue end
        if ent:IsPlayer() and ent:Team() == TEAM_SPECTATOR then continue end
        if ent:Health() > 0 then
          if self:IsInSight(ent) or self:GetPos():Distance(ent:GetPos()) <= 200 then
            self:AddEntityRelationship(ent, D_HT, 99)
            self:SetEnemy(ent)
            foundEnemy = true
            break
          end
        end
      end
    end
    
    if not foundEnemy then
      timer.Simple(0.5, function()
        if IsValid(self) and not self:HasEnemy() and self.InvestigatingSound then
          self:StartLookAroundSequence()
        else
          if IsValid(self) then self:ResetSoundInvestigation() end
        end
      end)
    else
      self:ResetSoundInvestigation()
    end
  end


  function ENT:StartLookAroundSequence()
    if not IsValid(self) or self:HasEnemy() then 
      self:ResetSoundInvestigation()
      return 
    end
    
    print("[BON DEBUG] Starting 360 look around (v13 fix)")
    
    self.WalkSpeed = 0
    self.RunSpeed = 0
    self.IsLookingAround = true
    
    if math.random() < 0.5 then
      self.LookAroundDirection = 1
      print("[BON DEBUG] Look around direction: RIGHT (clockwise)")
    else
      self.LookAroundDirection = -1
      print("[BON DEBUG] Look around direction: LEFT (counter-clockwise)")
    end
    
    self.LookAroundStartTime = CurTime()
    self.LookAroundTotalDuration = 8.0
    self.LookAroundSpinSpeed = 50.0
    
    self.LookAroundYaw = self:GetAngles().y
    self.LookAroundLastUpdateTime = CurTime()
    
    print("[BON DEBUG] Look around: " .. self.LookAroundTotalDuration .. "s, " .. self.LookAroundSpinSpeed .. " deg/s, startYaw=" .. math.Round(self.LookAroundYaw, 1))
  end
  
  function ENT:UpdateLookAround()
    if not IsValid(self) or not self.IsLookingAround then return end
    
    local currentTime = CurTime()
    
    if currentTime - self.LookAroundStartTime >= self.LookAroundTotalDuration then
      print("[BON DEBUG] Look around completed (timeout)")
      self:FinishLookAround()
      return
    end
    
    for _, ent in pairs(ents.FindInSphere(self:GetPos(), self.SightRange)) do
      if IsValid(ent) and (ent:IsPlayer() or ent:IsNPC() or ent:IsNextBot()) and ent != self then
        if self:ShouldIgnoreTarget(ent) then continue end
        if ent:IsPlayer() and ent:Team() == TEAM_SPECTATOR then continue end
        if ent:Health() > 0 and self:IsInSight(ent) then
          print("[BON DEBUG] Found enemy during look around: " .. tostring(ent) .. " - ENGAGING!")
          
          self:AddEntityRelationship(ent, D_HT, 99)
          self:SetEnemy(ent)
          
          self.IsLookingAround = false
          self.LookAroundYaw = nil
          self.LookAroundLastUpdateTime = nil
          
          self.InvestigatingSound = false
          self.SoundInvestigationComplete = false
          self.SoundTargetPos = nil
          self.SoundInvestigationStartTime = nil
          self.LookAroundDirection = nil
          self.LookAroundStartTime = nil
          
          if IsValid(self.SoundTarget) then
            self.SoundTarget:Remove()
            self.SoundTarget = nil
          end
          
          local lookTimer = "BonSoundInvestigation_" .. self:EntIndex()
          if timer.Exists(lookTimer) then
            timer.Remove(lookTimer)
          end
          
          if not self:IsCrouching() then
            self.WalkSpeed = self.DefaultRunSpeed
            self.RunSpeed = self.DefaultRunSpeed
          else
            self.WalkSpeed = self.CrouchSpeed
            self.RunSpeed = self.CrouchSpeed
          end
          
          if self.IsStalking then self:StopStalking() end
          
          return
        end
      end
    end
    
    local dt = currentTime - self.LookAroundLastUpdateTime
    self.LookAroundLastUpdateTime = currentTime
    
    self.LookAroundYaw = self.LookAroundYaw + (self.LookAroundSpinSpeed * self.LookAroundDirection * dt)
    self.LookAroundYaw = math.NormalizeAngle(self.LookAroundYaw)
    
    local myPos = self:GetPos()
    local targetDir = Angle(0, self.LookAroundYaw, 0):Forward()
    local facePoint = myPos + targetDir * 500
    
    if self.loco and self.loco.FaceTowards then
      self.loco:FaceTowards(facePoint)
    end
    
    self:SetAngles(Angle(0, self.LookAroundYaw, 0))
    
    self.WalkSpeed = 0
    self.RunSpeed = 0
  end
  
  function ENT:FinishLookAround()
    if not IsValid(self) then return end
    self.IsLookingAround = false
    self.LookAroundYaw = nil
    self.LookAroundLastUpdateTime = nil
    
    local hasRealEnemy = false
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      local enemy = self:GetEnemy()
      local eName = enemy:GetName() or ""
      if enemy:GetClass() != "info_target" or (not string.find(eName, "BonSoundTarget_") and not string.find(eName, "BonStalkTarget_")) then
        hasRealEnemy = true
      end
    end
    
    if hasRealEnemy then
      print("[BON DEBUG] FinishLookAround: has real enemy, switching to chase mode")
      if not self:IsCrouching() then
        self.WalkSpeed = self.DefaultRunSpeed
        self.RunSpeed = self.DefaultRunSpeed
      else
        self.WalkSpeed = self.CrouchSpeed
        self.RunSpeed = self.CrouchSpeed
      end
      self.InvestigatingSound = false
      self.SoundInvestigationComplete = false
      self.SoundTargetPos = nil
      self.SoundInvestigationStartTime = nil
      
      if IsValid(self.SoundTarget) then
        self.SoundTarget:Remove()
        self.SoundTarget = nil
      end
    else
      if not self:IsCrouching() then
        self.WalkSpeed = self.DefaultWalkSpeed
        self.RunSpeed = self.DefaultRunSpeed
      else
        self.WalkSpeed = self.CrouchSpeed
        self.RunSpeed = self.CrouchSpeed
      end
      self:ResetSoundInvestigation()
      
      if GetConVar("bon_rage_mode") and GetConVar("bon_rage_mode"):GetBool() then
        local myPos = self:GetPos()
        local forward = self:GetForward()
        local searchPos = myPos + forward * 500
        print("[BON DEBUG] Rage mode: restarting stalk after look around")
        timer.Simple(0.5, function()
          if IsValid(self) and not self:HasEnemy() and not self.IsStalking then
            self:StartStalking(searchPos)
          end
        end)
      end
    end
  end


  function ENT:ResetSoundInvestigation()
    if not IsValid(self) then return end
    
    self.InvestigatingSound = false
    self.SoundInvestigationComplete = false
    self.SoundTargetPos = nil
    self.SoundInvestigationStartTime = nil
    self.IsLookingAround = false
    self.LookAroundDirection = nil
    self.LookAroundStartTime = nil
    self.LookAroundYaw = nil
    self.LookAroundLastUpdateTime = nil
    
    if IsValid(self.SoundTarget) then
      if self:HasEnemy() and self:GetEnemy() == self.SoundTarget then
        self:SetEnemy(NULL)
      end
      self.SoundTarget:Remove()
      self.SoundTarget = nil
    end
    
    if not self:IsCrouching() then
      self.WalkSpeed = self.DefaultWalkSpeed
      self.RunSpeed = self.DefaultRunSpeed
    else
      self.WalkSpeed = self.CrouchSpeed
      self.RunSpeed = self.CrouchSpeed
    end
    
    local lookTimer = "BonSoundInvestigation_" .. self:EntIndex()
    if timer.Exists(lookTimer) then
      timer.Remove(lookTimer)
    end
  end



  function ENT:CanDetectSounds(sourcePos)
    if not IsValid(self) or not sourcePos then return false end
    
    if not self.SoundRange then self.SoundRange = 4000 end
    if not self.SightRange then self.SightRange = 2000 end
    if not self.LoseRange then self.LoseRange = 3000 end
    
    local distance = self:GetPos():Distance(sourcePos)
    
    if distance > self.SoundRange then return false end
    
    local trace = util.TraceLine({
      start = self:EyePos(),
      endpos = sourcePos,
      filter = self
    })
    
    local hasDirectSight = not trace.Hit
    
    if hasDirectSight then
      return distance <= self.SightRange
    else
      return distance <= self.LoseRange
    end
  end
  


function ENT:IsCrouching()
    return self:GetNW2Bool("IsCrouching")
end

function ENT:ToCrouch()
    self:SetNW2Bool("IsCrouching", true)
    self.WalkSpeed = self.CrouchSpeed
    self.RunSpeed = self.CrouchSpeed
    self.IdleAnimation = self.CrouchAnimation
    self.WalkAnimation = self.CrouchWalkAnimation
    self.RunAnimation = self.CrouchWalkAnimation
    if isvector(self.CrouchCollisionBounds) then
    self:SetCollisionBounds(
      Vector(self.CrouchCollisionBounds.x, self.CrouchCollisionBounds.y, self.CrouchCollisionBounds.z),
      Vector(-self.CrouchCollisionBounds.x, -self.CrouchCollisionBounds.y, 0)
    )
  else
    self:SetCollisionBounds(self:GetModelBounds())
  end
end

function ENT:UnCrouch()
    self:SetNW2Bool("IsCrouching", false)
    self.WalkSpeed = self.DefaultWalkSpeed
    self.RunSpeed = self.DefaultRunSpeed
    self.IdleAnimation = self.DefaultIdleAnimation
    self.WalkAnimation = self.DefaultWalkAnimation
    self.RunAnimation = self.DefaultRunAnimation
  if isvector(self.CollisionBounds) then
    self:SetCollisionBounds(
      Vector(self.CollisionBounds.x, self.CollisionBounds.y, self.CollisionBounds.z),
      Vector(-self.CollisionBounds.x, -self.CollisionBounds.y, 0)
    )
  else
    self:SetCollisionBounds(self:GetModelBounds())
  end
end


function ENT:ForceUnCrouch()
    if self:IsCrouching() then
        self:UnCrouch()
        self:SetCooldown("AI_UnCrouch", 0)
    end
end

  function ENT:OnMeleeAttack(enemy)
    if IsValid(enemy) and enemy:GetClass() == "info_target" then
      local eName = enemy:GetName() or ""
      if string.find(eName, "BonSoundTarget_") or string.find(eName, "BonStalkTarget_") then
        return
      end
    end
    
    if self.InvestigatingSound then return end
    
    if self:ShouldIgnoreTarget(enemy) then return end
    
    if enemy:IsPlayer() and self.GrabbedEntity == nil and !IsValid(enemy.HideSpot) then
      self.IsKilling = true
      self:StopAllBonSounds()
      if self.IsStalking then self:StopStalking() end
      
      local usePlayerAnim = GetConVar("bon_kill_anim_players"):GetBool()
      
      self:TeleportVictimInFront(enemy)

      if usePlayerAnim then
        self:NextbotNextbotJumpscarePlayer(enemy, function()
          local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
          local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
          self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
        end, function()
          self.IsKilling = false
          self:ResetSoundSystem()
          self:ForceUnCrouch()
        end)
      else
        local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
        local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
        self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
        self:StopKillEnforcement(enemy)
        enemy:TakeDamage(math.huge, self, self)
        self:StopRagdollVelocity(enemy)
        self.IsKilling = false
        self:ResetSoundSystem()
        self:ForceUnCrouch()
      end
    elseif not enemy:IsPlayer() then
      self:KillNPC(enemy)
    end
  end

  function ENT:KillNPC(npc)
    if GetConVar("ai_disabled"):GetBool() == false then
      if not IsValid(npc) or not IsValid(self) then return end
    
    if self:ShouldIgnoreTarget(npc) then return end
    
    if self.IsStalking then self:StopStalking() end
    
    self.IsKilling = true
    self:StopAllBonSounds()

    local useAnim = true
    if npc:IsNextBot() then
      useAnim = GetConVar("bon_kill_anim_nextbots"):GetBool()
    elseif npc:IsNPC() then
      useAnim = GetConVar("bon_kill_anim_npcs"):GetBool()
    end

    
    self:TeleportVictimInFront(npc)
    
    local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
    local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
    self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
    
    if useAnim then
      self:CallInCoroutine(function(self)
        if not IsValid(self) then 
          if IsValid(npc) then
            self:UnfreezeNPC(npc)
          end
          return 
        end
        
        self:PlaySequenceAndMove("kill")
        
        if IsValid(npc) then
          self:StopKillEnforcement(npc)
          npc:TakeDamage(math.huge, self)
          self:StopRagdollVelocity(npc)
          self:UnfreezeNPC(npc)
        end
        
        if IsValid(self) then
          self.IsKilling = false
          self:ResetSoundSystem()
          self:ForceUnCrouch()
        end
      end)
    else
      if IsValid(npc) then
        self:StopKillEnforcement(npc)
        npc:TakeDamage(math.huge, self)
        self:StopRagdollVelocity(npc)
        self:UnfreezeNPC(npc)
      end
      
      self.IsKilling = false
      self:ResetSoundSystem()
      self:ForceUnCrouch()
    end
    end
  end

  function ENT:AttackForNpc()
    local canBreakProps = GetConVar("bon_break_props") and GetConVar("bon_break_props"):GetBool()
    if not canBreakProps then return end
    
    local entstoattack = ents.FindInSphere(self:LocalToWorld(Vector(0,0,0)), 40)
    for _,v in pairs(entstoattack) do
      if not IsValid(v) then continue end
      if v == self then continue end
      if v:IsPlayer() or v:IsNPC() or v:IsNextBot() then continue end

      local class = v:GetClass()
      
      if class == "info_target" or class == "ca_camera" or
         class == "light_dynamic" or class == "env_projectedtexture" then
        continue
      end

      
      local isBreakable = class == "prop_physics" or
                          class == "prop_physics_multiplayer" or
                          class == "prop_physics_override" or
                          class == "func_breakable" or
                          class == "func_physbox" or
                          class == "prop_dynamic" or
                          v:Health() > 0

      if isBreakable and IsValid(self) then
        v:TakeDamage(math.huge, self, self)
      end
    end
  end

  
  
  
  
  
  
  
  
  function ENT:HandleRagdollCollision()
    if not IsValid(self) then return end
    
    local shouldCollide = GetConVar("bon_ragdoll_collision") and GetConVar("bon_ragdoll_collision"):GetBool()
    
    
    if not self._bonOwnedRagdolls then
      self._bonOwnedRagdolls = {}
    end
    
    
    for entIdx, _ in pairs(self._bonOwnedRagdolls) do
      if not IsValid(Entity(entIdx)) then
        self._bonOwnedRagdolls[entIdx] = nil
      end
    end
    
    
    if shouldCollide then
      for entIdx, _ in pairs(self._bonOwnedRagdolls) do
        local ent = Entity(entIdx)
        if IsValid(ent) and ent:GetOwner() == self then
          ent:SetOwner(NULL)
        end
      end
      self._bonOwnedRagdolls = {}
      return
    end
    
    local nearbyEnts = ents.FindInSphere(self:GetPos(), 200)
    for _, ent in pairs(nearbyEnts) do
      if not IsValid(ent) then continue end
      
      local class = ent:GetClass()
      if class == "prop_ragdoll" or class == "class C_ClientRagdoll" or class == "class C_HL2MPRagdoll" then
        local entIdx = ent:EntIndex()
        if not self._bonOwnedRagdolls[entIdx] then
          
          
          
          ent:SetOwner(self)
          self._bonOwnedRagdolls[entIdx] = true
        end
      end
    end
  end

  
  
  
  
  
  function ENT:BreakGlass()
    local canBreakGlass = GetConVar("bon_break_glass") and GetConVar("bon_break_glass"):GetBool()
    if not canBreakGlass then return end
    
    local glassEnts = ents.FindInSphere(self:LocalToWorld(Vector(0,0,0)), 50)
    for _, ent in pairs(glassEnts) do
      if not IsValid(ent) then continue end
      
      local class = ent:GetClass()
      
      
      if class == "func_breakable_surf" then
        ent:Fire("Shatter", "0 0 0", 0)
        continue
      end
      
      
      if class == "func_breakable" then
        local mat = ent:GetMaterialType()
        
        ent:Fire("Break", "", 0)
        continue
      end
      
      
      if class == "prop_physics" or class == "prop_physics_multiplayer" then
        local model = (ent:GetModel() or ""):lower()
        if string.find(model, "glass") or string.find(model, "window") then
          ent:TakeDamage(math.huge, self, self)
          continue
        end
      end
    end
  end
  
  
  
  
  
  
  function ENT:PropAttack()
    local prop = ents.FindInSphere(self:LocalToWorld(Vector(0,0,0)), 25)
    for _,ent in pairs(prop) do
      if IsValid(ent) and IsValid(self) then
        local class = ent:GetClass()
        
        
        local isDoor = class == "prop_door_rotating" or class == "func_door_rotating" or
                       class == "func_door" or class == "prop_dynamic" or
                       class == "func_movelinear"
        local isGate = string.find(class, "gate") or string.find(class, "door")
        
        if isDoor or isGate then
          local canOpen = GetConVar("bon_door_open") and GetConVar("bon_door_open"):GetBool()
          local canBreak = GetConVar("bon_door_break") and GetConVar("bon_door_break"):GetBool()
          
          if canBreak and (class == "prop_door_rotating" or class == "func_door_rotating") then
            
            local mdl = ent:GetModel()
            local pos = ent:GetPos()
            local ang = ent:GetAngles()
            local skin = ent:GetSkin()
            ent:Remove()
            local door = ents.Create("prop_physics")
            if door then
              door:SetModel(mdl)
              door:SetPos(pos)
              door:SetAngles(ang)
              if skin != nil then
                door:SetSkin(skin)
              end
              door:Spawn()
              door:EmitSound("physics/metal/metal_box_break" .. math.random(1, 2) .. ".wav")
              if IsValid(door:GetPhysicsObject()) then
                constraint.NoCollide(door, self)
                door:GetPhysicsObject():AddVelocity(self:GetForward():GetNormalized() * 125 + Vector(0, 0, 2))
                door:GetPhysicsObject():EnableMotion(true)
                door:SetCollisionGroup(COLLISION_GROUP_WEAPON)
                timer.Simple(3.5, function()
                  if door:IsValid() then door:Remove() end
                end)
              end
            end
          elseif canOpen then
            
            if class == "prop_door_rotating" or class == "func_door_rotating" then
              ent:Fire("Open", "", 0)
            elseif class == "func_door" then
              ent:Fire("Open", "", 0)
            elseif class == "func_movelinear" then
              ent:Fire("Open", "", 0)
            else
              
              ent:Fire("Toggle", "", 0)
            end
            
            self:SetCooldown("DoorOpen", 1.5)
          end
        elseif not string.find(class, "door") and (not ent:IsPlayer() and not ent:IsNPC() and not ent:IsNextBot()) then
          self:AttackForNpc()
        end
      end
    end
  end

  
  function ENT:StopAllBonSounds()
    self:StopSound("dark/bon/bonsound1.mp3") 
    self:StopSound("dark/bon/bonsound2.mp3") 
  end

  function ENT:StopAllBonSoundsIncludingKill()
    self:StopSound("dark/bon/bonsound1.mp3") 
    self:StopSound("dark/bon/bonsound2.mp3")
    self:StopSound("dark/bon/bon_kill.wav")  
  end

  function ENT:ResetSoundSystem()
    self:StopAllBonSounds()
    self.SoundState = "none"
    self.NextChaseSoundTime = 0
    self.NextIdleSoundTime = 0
  end

 
  function ENT:UpdateSoundSystem()
    if not IsValid(self) then return end
    
    local currentTime = CurTime()
    local hasEnemy = self:HasEnemy()
    local isMoving = self:IsMoving()
    
    local isSoundTarget = false
    local isRealEnemy = false
    local isStalkTarget = false
    
    if hasEnemy and IsValid(self:GetEnemy()) then
      local enemy = self:GetEnemy()
      local eName = enemy:GetName() or ""
      if enemy:GetClass() == "info_target" and string.find(eName, "BonSoundTarget_") then
        isSoundTarget = true
      elseif enemy:GetClass() == "info_target" and string.find(eName, "BonStalkTarget_") then
        isStalkTarget = true
      else
        isRealEnemy = true
      end
    end
    
    local desiredState = "none"
    if hasEnemy and not self.IsKilling then 
      if isRealEnemy then
        desiredState = "chase"
      elseif isStalkTarget then
        desiredState = "chase"
      elseif isSoundTarget then
        desiredState = "none"
      end
    elseif self.IsStalking and not self.IsKilling then
      desiredState = "chase"
    elseif not isMoving and not hasEnemy and not self.IsKilling and not self.InvestigatingSound and not self.IsStalking then
      desiredState = "idle"
    end
    
    if self.SoundState != desiredState then
      if not (self.SoundState == "chase" and desiredState == "chase") then
        self:StopAllBonSounds()
      end
      self.SoundState = desiredState
      
      if desiredState == "chase" then
        self.NextChaseSoundTime = currentTime + 0.1
      elseif desiredState == "idle" then
        self.NextIdleSoundTime = currentTime + 1 
      end
    end
    
    if not self.IsKilling then
      if self.SoundState == "chase" and (isRealEnemy or isStalkTarget or self.IsStalking) and currentTime >= self.NextChaseSoundTime then
        local volume = GetConVar("bon_sound_volume_idle"):GetInt()
        local pitch = GetConVar("bon_sound_pitch_idle"):GetInt()
        self:EmitSound("dark/bon/bonsound1.mp3", volume, pitch)
        self.NextChaseSoundTime = currentTime + 7 + math.random(3, 5)
      elseif self.SoundState == "idle" and not hasEnemy and not isMoving and currentTime >= self.NextIdleSoundTime then
        local volume = GetConVar("bon_sound_volume_idle"):GetInt()
        local pitch = GetConVar("bon_sound_pitch_idle"):GetInt()
        self:EmitSound("dark/bon/bonsound2.mp3", volume, pitch)
        self.NextIdleSoundTime = currentTime + 7 + math.random(7, 12)
      end
    end
  end

  
  function ENT:CleanupAllJumpscares()
    if not IsValid(self) then return end
    
    for _, ply in pairs(player.GetAll()) do
      if IsValid(ply) then
        ply:Freeze(false)
        
        if ply._bonOrigMoveType then
          ply:SetMoveType(ply._bonOrigMoveType)
          ply._bonOrigMoveType = nil
        end
        ply:SetLocalVelocity(Vector(0, 0, 0))
        ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
        ply:SetNWBool("BonLockView", false)
        ply:SetNWEntity("BonLockViewEntity", NULL)
        ply:RemoveFlags(FL_NOTARGET)
        ply:DrawViewModel(true)
        
        
        net.Start("bon_lock_player_view")
        net.WriteBool(false)
        net.WriteEntity(self)
        net.Send(ply)
        
        net.Start("bon_nextbot_jumpscare_cleanup")
        net.WriteEntity(self)
        net.WriteBool(false)
        net.Send(ply)
      end
    end
    
    self.IsKilling = false
    self:StopAllBonSoundsIncludingKill()  
    self:ForceUnCrouch()
  end

  function ENT:OnLoseEnemy()
    print("[BON DEBUG] Lost enemy")
    
    if not self.IsStalking and not self.InvestigatingSound and not self.IsKilling then
      if self:IsCustomAIEnabled() and self.LastKnownEnemyPos then
        print("[BON DEBUG] OnLoseEnemy: Starting stalking from last known pos!")
        self:StartStalking(self.LastKnownEnemyPos)
      end
    end
  end

  function ENT:OnNewEnemy()
    print("[BON DEBUG] New enemy detected")
    
    if self.IsStalking then
      local enemy = self:GetEnemy()
      if IsValid(enemy) and enemy:GetClass() != "info_target" then
        print("[BON DEBUG] Found real enemy, stopping stalk")
        self:StopStalking()
      end
    end
  end

  function ENT:PerformJumpscare(ply)
    if GetConVar("ai_ignoreplayers"):GetBool() == false and GetConVar("ai_disabled"):GetBool() == false then
      self.IsKilling = true
      self:StopAllBonSounds()
      if self.IsStalking then self:StopStalking() end
    
      local usePlayerAnim = GetConVar("bon_kill_anim_players"):GetBool()
      
      self:TeleportVictimInFront(ply)
      
      if usePlayerAnim then
        self:NextbotNextbotJumpscarePlayer(ply, function()
          local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
          local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
          self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
        end, function()
          self.IsKilling = false
          self:ResetSoundSystem()
          self:ForceUnCrouch()
        end)
      else
        local volume = GetConVar("bon_sound_volume_jumpscare"):GetInt()
        local pitch = GetConVar("bon_sound_pitch_jumpscare"):GetInt()
        self:EmitSound("dark/bon/bon_kill.wav", volume, pitch)
        self:StopKillEnforcement(ply)
        ply:TakeDamage(math.huge, self, self)
        self:StopRagdollVelocity(ply)
        self.IsKilling = false
        self:ResetSoundSystem()
        self:ForceUnCrouch()
      end
    end
  end

  function ENT:GetObstacleHeight(hitPos, startPos)
    local groundTrace = util.TraceLine({
      start = startPos,
      endpos = startPos + Vector(0, 0, -200),
      filter = self
    })
    local groundZ = groundTrace.HitPos.z
    local obstacleZ = hitPos.z
    return obstacleZ - groundZ
  end


function ENT:ShouldAvoidCrawling(hitEnt)
    if not IsValid(hitEnt) then return true end
    
    if hitEnt:IsPlayer() or hitEnt:IsNPC() or hitEnt:IsNextBot() or 
       hitEnt.IsDrGNextbot or hitEnt.IsVJBaseSNPC or hitEnt.CPTBase_NPC then
        return true
    end
    
    local class = hitEnt:GetClass():lower()
    local model = (hitEnt:GetModel() or ""):lower()
    
    local avoidClasses = {"door", "fence", "gate", "chair", "stool", "vehicle"}
    local avoidModels = {"chainlink", "fence", "gate", "chair", "stool"}
    
    for _, avoid in pairs(avoidClasses) do
        if string.find(class, avoid) then return true end
    end
    
    for _, avoid in pairs(avoidModels) do
        if string.find(model, avoid) then return true end
    end
    
    return false
end

function ENT:CanMoveInAnyDirection()
    if not IsValid(self) then return false end
    
    local startPos = self:GetPos()
    local testDistance = 50 
    local mins, maxs = self:GetCollisionBounds()
    
    if self:IsCrouching() then
        maxs = Vector(maxs.x, maxs.y, 36)
    end
    
    local testDirections = {
        Vector(1, 0, 0), Vector(-1, 0, 0),
        Vector(0, 1, 0), Vector(0, -1, 0),
        Vector(1, 1, 0):GetNormalized(), Vector(1, -1, 0):GetNormalized(),
        Vector(-1, 1, 0):GetNormalized(), Vector(-1, -1, 0):GetNormalized(),
        Vector(0, 0, 1),
    }
    
    local canMoveCount = 0
    
    for _, direction in pairs(testDirections) do
        local endPos = startPos + direction * testDistance
        local trace = util.TraceHull({
            start = startPos,
            endpos = endPos,
            mins = mins,
            maxs = maxs,
            filter = self
        })
        
        if not trace.Hit or trace.Fraction > 0.3 then
            canMoveCount = canMoveCount + 1
        end
    end
    
    return canMoveCount >= 4
end


function ENT:IsStuck()
    local currentTime = CurTime()
    
    if currentTime - self.LastStuckCheck < self.StuckCheckInterval then
        return false
    end
    
    local currentPos = self:GetPos()
    local distance = currentPos:Distance(self.LastPosition)
    local currentVelocity = self:GetVelocity():Length()
    local currentAngles = self:GetAngles()
    
    if GetConVar("ai_disabled"):GetBool() then
        self.StuckTime = 0
        self.VelocityStuckTime = 0
        self.OnlyHeadMovingTime = 0
        self.CompleteStuckTime = 0
        self.EnemyStuckTime = 0
        self.PatrolStuckTime = 0
        self.SoundChaseStuckTime = 0
        self.StalkStuckTime = 0
        return false
    end
    
    local hasRealEnemy = false
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
        local enemy = self:GetEnemy()
        local eName = enemy:GetName() or ""
        if enemy:GetClass() != "info_target" or (not string.find(eName, "BonSoundTarget_") and not string.find(eName, "BonStalkTarget_")) then
            hasRealEnemy = true
        end
    end
    
    if self.IsLookingAround then
        self:ResetStuckCounters()
        return false
    end
    
    if hasRealEnemy and self:IsEnemyOnDifferentElevation() then
        self:ResetStuckCounters()
        return false
    end
    
    local isInIdleState = not hasRealEnemy and not self.InvestigatingSound and not self.IsStalking and not self:IsMoving()
    
    if isInIdleState then
        if self:CanMoveInAnyDirection() then
            self:ResetStuckCounters()
            return false
        else
            self.IdleStuckTime = (self.IdleStuckTime or 0) + self.StuckCheckInterval
            if self.IdleStuckTime >= self.MaxStuckTime then 
                self.LastPosition = currentPos
                self.LastAngles = currentAngles
                self.LastStuckCheck = currentTime
                return true
            end
            self.LastPosition = currentPos
            self.LastAngles = currentAngles
            self.LastStuckCheck = currentTime
            return false
        end
    else
        self.IdleStuckTime = 0
    end
    
    local currentSpeed = 0
    if self:IsCrouching() then
        currentSpeed = self.CrouchSpeed or 40
    elseif hasRealEnemy then
        currentSpeed = self.RunSpeed or 550
    else
        currentSpeed = self.WalkSpeed or 50
    end
    
    local expectedMinDistance = (currentSpeed * self.StuckCheckInterval) * 0.3 
    local adaptiveStuckDistance = math.max(expectedMinDistance, 15)
    if currentSpeed < 20 then adaptiveStuckDistance = 8 end
    
    local isEnemyStuck = false
    if hasRealEnemy then
        if currentVelocity < 1 and distance < 5 then
            self.EnemyStuckTime = (self.EnemyStuckTime or 0) + self.StuckCheckInterval
            if self.EnemyStuckTime >= self.MaxStuckTime then isEnemyStuck = true end
        else
            self.EnemyStuckTime = 0
        end
    else
        self.EnemyStuckTime = 0
    end
    
    local isSoundStuck = false
    if self.InvestigatingSound and not self.IsLookingAround then 
        if currentVelocity < 1 and distance < 5 then
            self.SoundChaseStuckTime = (self.SoundChaseStuckTime or 0) + self.StuckCheckInterval
            if self.SoundChaseStuckTime >= self.MaxStuckTime then isSoundStuck = true end
        else
            self.SoundChaseStuckTime = 0
        end
    else
        self.SoundChaseStuckTime = 0
    end
    
    local isStalkStuck = false
    if self.IsStalking and not self.IsLookingAround then
        if currentVelocity < 1 and distance < 5 then
            self.StalkStuckTime = (self.StalkStuckTime or 0) + self.StuckCheckInterval
            if self.StalkStuckTime >= self.MaxStuckTime then isStalkStuck = true end
        else
            self.StalkStuckTime = 0
        end
    else
        self.StalkStuckTime = 0
    end
    
    local isPatrolStuck = false
    if not hasRealEnemy and not self.InvestigatingSound and not self.IsLookingAround and not self.IsStalking and self:IsMoving() then
        if currentVelocity < 1 and distance < 5 then
            self.PatrolStuckTime = (self.PatrolStuckTime or 0) + self.StuckCheckInterval
            if self.PatrolStuckTime >= self.MaxStuckTime then isPatrolStuck = true end
        else
            self.PatrolStuckTime = 0
        end
    else
        self.PatrolStuckTime = 0
    end
    
    local isCompletelyStuck = false
    if self:IsMoving() and currentVelocity < 1 and distance < 5 and not self.IsLookingAround then 
        self.CompleteStuckTime = (self.CompleteStuckTime or 0) + self.StuckCheckInterval
        if self.CompleteStuckTime >= self.MaxStuckTime then isCompletelyStuck = true end
    else
        self.CompleteStuckTime = 0
    end
    
    local isRegularStuck = false
    if self:IsMoving() and currentVelocity > 1 and not self.IsLookingAround then 
        if distance < adaptiveStuckDistance then
            self.StuckTime = self.StuckTime + self.StuckCheckInterval
            if self.StuckTime >= self.MaxStuckTime then isRegularStuck = true end
        else
            self.StuckTime = 0
        end
    else
        self.StuckTime = 0 
    end
    
    local isVelocityStuck = false
    if hasRealEnemy and self:IsMoving() and not self.IsLookingAround then 
        if currentVelocity < 3 and distance < 8 then 
            self.VelocityStuckTime = self.VelocityStuckTime + self.StuckCheckInterval
            if self.VelocityStuckTime >= self.MaxVelocityStuckTime then isVelocityStuck = true end
        else
            self.VelocityStuckTime = 0
        end
        
        local angleDistance = math.abs(self.LastAngles.y - currentAngles.y)
        if angleDistance > 15 and distance < 8 and currentVelocity < 3 then 
            self.OnlyHeadMovingTime = self.OnlyHeadMovingTime + self.StuckCheckInterval
        else
            self.OnlyHeadMovingTime = 0
        end
    else
        self.VelocityStuckTime = 0
        self.OnlyHeadMovingTime = 0
    end
    
    self.LastPosition = currentPos
    self.LastAngles = currentAngles
    self.LastStuckCheck = currentTime
    
    local isHeadOnlyStuck = self.OnlyHeadMovingTime >= self.MaxHeadOnlyTime
    
    return isEnemyStuck or isSoundStuck or isStalkStuck or isPatrolStuck or isCompletelyStuck or isRegularStuck or isVelocityStuck or isHeadOnlyStuck
end

    
  function ENT:FindUnstuckPosition()
    local basePos = self:GetPos()
    local attempts = {
      {Vector(80, 0, 0), Vector(-80, 0, 0)},
      {Vector(0, 80, 0), Vector(0, -80, 0)},
      {Vector(60, 60, 0), Vector(-60, -60, 0)},
      {Vector(60, -60, 0), Vector(-60, 60, 0)},
      {Vector(150, 0, 0), Vector(-150, 0, 0)},
      {Vector(0, 150, 0), Vector(0, -150, 0)},
      {Vector(120, 120, 0), Vector(-120, -120, 0)},
      {Vector(120, -120, 0), Vector(-120, 120, 0)},
      {Vector(250, 0, 0), Vector(-250, 0, 0)},
      {Vector(0, 250, 0), Vector(0, -250, 0)},
      {Vector(0, 0, 150), Vector(0, 0, -50)},
      {Vector(100, 0, 100), Vector(-100, 0, 100)},
      {Vector(0, 100, 100), Vector(0, -100, 100)},
    }
    
    for _, directions in pairs(attempts) do
      for _, offset in pairs(directions) do
        local testPos = basePos + offset
        if self:IsPositionValid(testPos) then
          return testPos
        end
      end
    end
    
    if navmesh.IsLoaded() then
      local nearestArea = navmesh.GetNearestNavArea(basePos, 1000)
      if nearestArea then
        local navPos = nearestArea:GetClosestPointOnArea(basePos)
        if self:IsPositionValid(navPos) then return navPos end
        for _, adjacentArea in pairs(nearestArea:GetAdjacentAreas()) do
          local adjPos = adjacentArea:GetCenter()
          if self:IsPositionValid(adjPos) then return adjPos end
        end
      end
    end
    
    return nil
  end

  function ENT:IsPositionValid(pos)
    if not util.IsInWorld(pos) then return false end
    
    local mins, maxs = self:GetCollisionBounds()
    if self:IsCrouching() then maxs = Vector(maxs.x, maxs.y, 36) end
    
    local trace = util.TraceHull({
      start = pos, endpos = pos,
      mins = mins, maxs = maxs,
      filter = self
    })
    if trace.Hit then return false end
    
    local groundTrace = util.TraceLine({
      start = pos,
      endpos = pos + Vector(0, 0, -200),
      filter = self
    })
    if not groundTrace.Hit or (pos.z - groundTrace.HitPos.z) > 150 then return false end
    
    return true
  end

  function ENT:Unstuck()
    local wasInvestigatingSound = self.InvestigatingSound
    local savedSoundTarget = self.SoundTarget
    local savedSoundTargetPos = self.SoundTargetPos
    local savedSoundInvestigationComplete = self.SoundInvestigationComplete
    local savedIsLookingAround = self.IsLookingAround
    
    local wasStalking = self.IsStalking
    local savedStalkTargetEnt = self.StalkTargetEnt
    local savedStalkCurrentTarget = self.StalkCurrentTarget
    local savedStalkStartTime = self.StalkStartTime
    local savedStalkSearchIndex = self.StalkSearchIndex
    local savedStalkLastKnownPos = self.StalkLastKnownPos
    
    self:SetVelocity(Vector(0, 0, 0))
    local unstuckPos = self:FindUnstuckPosition()
    
    if unstuckPos then
      self:SetPos(unstuckPos)
      self:ResetStuckCounters()
      self:SetVelocity(Vector(0, 0, 0))
      
      if wasInvestigatingSound then
        self.InvestigatingSound = wasInvestigatingSound
        self.SoundTarget = savedSoundTarget
        self.SoundTargetPos = savedSoundTargetPos
        self.SoundInvestigationComplete = savedSoundInvestigationComplete
        self.IsLookingAround = savedIsLookingAround
        if IsValid(savedSoundTarget) then self:SetEnemy(savedSoundTarget) end
      end
      
      if wasStalking then
        self.IsStalking = true
        self.StalkStartTime = savedStalkStartTime
        self.StalkSearchIndex = savedStalkSearchIndex
        self.StalkLastKnownPos = savedStalkLastKnownPos
        self.StalkCurrentTarget = savedStalkCurrentTarget
        self.StalkTargetEnt = savedStalkTargetEnt
        if IsValid(savedStalkTargetEnt) then
          self:AddEntityRelationship(savedStalkTargetEnt, D_HT, 99)
          self:SetEnemy(savedStalkTargetEnt)
        elseif savedStalkCurrentTarget then
          self:SetStalkTarget(savedStalkCurrentTarget)
        end
      end
      
      if self:HasEnemy() and IsValid(self:GetEnemy()) then
        local lookAngle = (self:GetEnemy():GetPos() - self:GetPos()):Angle()
        self:SetAngles(Angle(0, lookAngle.y, 0))
      end
      
      return true
    else
      return self:EmergencyUnstuck()
    end
  end

  function ENT:ForceUnstuck()
    self:SetVelocity(Vector(0, 0, 0))
    
    local pushDirection = Vector(0, 0, 0)
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      pushDirection = (self:GetEnemy():GetPos() - self:GetPos()):GetNormalized()
    else
      local directions = {
        self:GetForward(), self:GetRight(), -self:GetRight(), -self:GetForward(),
        (self:GetForward() + self:GetRight()):GetNormalized(),
        (self:GetForward() - self:GetRight()):GetNormalized()
      }
      pushDirection = directions[math.random(#directions)]
    end
    
    for _, dist in pairs({60, 100, 150, 200, 300}) do
      local newPos = self:GetPos() + pushDirection * dist
      local newPosUp = newPos + Vector(0, 0, 50)
      
      if self:IsPositionValid(newPos) then
        self:SetPos(newPos)
        self:ResetStuckCounters()
        return true
      elseif self:IsPositionValid(newPosUp) then
        self:SetPos(newPosUp)
        self:ResetStuckCounters()
        return true
      end
    end
    
    return self:Unstuck()
  end

function ENT:ResetStuckCounters()
    self.StuckTime = 0
    self.VelocityStuckTime = 0
    self.OnlyHeadMovingTime = 0
    self.CompleteStuckTime = 0
    self.EnemyStuckTime = 0
    self.PatrolStuckTime = 0
    self.SoundChaseStuckTime = 0
    self.StalkStuckTime = 0
    self.IdleStuckTime = 0
    self.LastPosition = self:GetPos()
    self.LastAngles = self:GetAngles()
    self.LastStuckCheck = CurTime()
end

  function ENT:EmergencyUnstuck()
    self:SetVelocity(Vector(0, 0, 0))
    self:ResetSoundInvestigation()
    
    local savedEnemy = nil
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      savedEnemy = self:GetEnemy()
      self:SetEnemy(NULL)
    end
    
    self.CheckingLocker = false
    self.IsLookingAround = false
    
    local emergencyPositions = {
      self:GetPos() + Vector(0, 0, 250),
      self:GetPos() + Vector(300, 0, 100),
      self:GetPos() + Vector(-300, 0, 100),
      self:GetPos() + Vector(0, 300, 100),
      self:GetPos() + Vector(0, -300, 100),
      self:GetPos() + Vector(200, 200, 150),
      self:GetPos() + Vector(-200, -200, 150),
      self:GetPos() + Vector(200, -200, 150),
      self:GetPos() + Vector(-200, 200, 150),
    }
    
    for i, pos in pairs(emergencyPositions) do
      if util.IsInWorld(pos) and self:IsPositionValid(pos) then
        self:SetPos(pos)
        self:ResetStuckCounters()
        if savedEnemy and IsValid(savedEnemy) then self:SetEnemy(savedEnemy) end
        return true
      end
    end
    
    for _, ply in pairs(player.GetAll()) do
      if IsValid(ply) and ply:Alive() then
        local testPos = ply:GetPos() + Vector(math.random(-200, 200), math.random(-200, 200), 50)
        if util.IsInWorld(testPos) and self:IsPositionValid(testPos) then
          self:SetPos(testPos)
          self:ResetStuckCounters()
          if savedEnemy and IsValid(savedEnemy) then self:SetEnemy(savedEnemy) end
          return true
        end
      end
    end
    
    return false
  end


  function ENT:CustomThink()
    if not self:IsPossessed() and not self.IsKilling then
      
      local hasRealEnemy = false
      if self:HasEnemy() and IsValid(self:GetEnemy()) then
        local enemy = self:GetEnemy()
        local eName = enemy:GetName() or ""
        if enemy:GetClass() != "info_target" or (not string.find(eName, "BonSoundTarget_") and not string.find(eName, "BonStalkTarget_")) then
          hasRealEnemy = true
        end
      end
      
      if hasRealEnemy and IsValid(self:GetEnemy()) then
        local enemy = self:GetEnemy()
        if self:ShouldIgnoreTarget(enemy) then
          self:SetEnemy(NULL)
          hasRealEnemy = false
        end
      end
      
      if hasRealEnemy and IsValid(self:GetEnemy()) then
        self.LastKnownEnemyPos = self:GetEnemy():GetPos()
        
        if self:IsCustomAIEnabled() then
          if not self:HasDirectLineOfSight(self:GetEnemy()) then
            self.NoLOSTime = (self.NoLOSTime or 0) + FrameTime()
            
            if self.NoLOSTime > 1.5 and not self.IsStalking then
              local lastPos = self.LastKnownEnemyPos
              self:SetEnemy(NULL)
              self:StartStalking(lastPos)
            end
          else
            self.NoLOSTime = 0
          end
        end
      end
      
      if self.IsStalking then
        if self:IsCustomAIEnabled() then
          self:UpdateStalking()
        else
          self:StopStalking()
        end
      end
      
      if self.InvestigatingSound and not self.SoundInvestigationComplete then
        if self:IsCustomAIEnabled() then
          self:UpdateSoundInvestigation()
        else
          self:ResetSoundInvestigation()
        end
      end
      
      if self.IsLookingAround then
        self:UpdateLookAround()
      end
      
      
      if GetConVar("bon_rage_mode") and GetConVar("bon_rage_mode"):GetBool() then
        if not hasRealEnemy and not self.IsStalking and not self.InvestigatingSound and not self.IsLookingAround then
          local searchPos = self:GetPos() + self:GetForward() * 500
          self:StartStalking(searchPos)
        end
      end
      
      
      local isInIdleState = not hasRealEnemy and not self.InvestigatingSound and not self.IsStalking and not self:IsMoving()
      local shouldCheckStuck = false
      
      if isInIdleState then
        shouldCheckStuck = not self:CanMoveInAnyDirection()
      else
        shouldCheckStuck = (hasRealEnemy or self.InvestigatingSound or self.IsStalking or self:IsMoving()) and not self.IsLookingAround
      end
      
      if shouldCheckStuck and not self.StuckDetectionDisabled and self:IsStuck() then
        if not self:Unstuck() then
          self:ForceUnstuck()
        end
      end
    end
    
    if self.IsLookingAround then
      self.WalkSpeed = 0
      self.RunSpeed = 0
    end
    
    
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      local currentEnemy = self:GetEnemy()
      local ceName = currentEnemy:GetName() or ""
      
      if currentEnemy:GetClass() == "info_target" and (string.find(ceName, "BonSoundTarget_") or string.find(ceName, "BonStalkTarget_")) then
        for _, ent in pairs(ents.FindInSphere(self:GetPos(), self.SightRange)) do
          if IsValid(ent) and (ent:IsPlayer() or ent:IsNPC() or ent:IsNextBot()) and ent != self then
            if self:ShouldIgnoreTarget(ent) then continue end
            if ent:IsPlayer() and ent:Team() == TEAM_SPECTATOR then continue end
            if ent:Health() > 0 and self:IsInSight(ent) then
              self:ResetSoundInvestigation()
              if self.IsStalking then self:StopStalking() end
              self:AddEntityRelationship(ent, D_HT, 99)
              self:SetEnemy(ent)
              break
            end
          end
        end
      end
    end
    
    if self.IsLookingAround then
      for _, ent in pairs(ents.FindInSphere(self:GetPos(), self.SightRange)) do
        if IsValid(ent) and (ent:IsPlayer() or ent:IsNPC() or ent:IsNextBot()) and ent != self then
          if self:ShouldIgnoreTarget(ent) then continue end
          if ent:IsPlayer() and ent:Team() == TEAM_SPECTATOR then continue end
          if ent:Health() > 0 and self:IsInSight(ent) then
            self:ResetSoundInvestigation()
            self:AddEntityRelationship(ent, D_HT, 99)
            self:SetEnemy(ent)
            break
          end
        end
      end
    end
    
    
    if self:HasEnemy() and IsValid(self:GetEnemy()) then
      local enemy = self:GetEnemy()
      local eName = enemy:GetName() or ""
      
      if not (enemy:GetClass() == "info_target" and (string.find(eName, "BonSoundTarget_") or string.find(eName, "BonStalkTarget_"))) then
        if self:ShouldLoseTargetBehindWalls() and not self.InvestigatingSound and not self.IsStalking then
          self.LastKnownEnemyPos = enemy:GetPos()
          self:LoseEntity(enemy)
          self:SetEnemy(NULL)
          self.CheckingLocker = false
        end
      end
    end

    
    if not self:IsPossessed() then
      local startpos = self:GetPos()
      local forw = self:GetForward()
      local right = self:GetRight() 
      local traceDistance = 30
      local standingMins = Vector(-10, -10, 0)
      local standingMaxs = Vector(10, 10, 72)
      local crouchingMaxs = Vector(10, 10, 36)
      local crawlWidth = 5

      local ceilingTrace = util.TraceLine({
        start = startpos,
        endpos = startpos + Vector(0, 0, 100),
        filter = self
      })
      local ceilingHeight = 100
      local ceilingEntity = NULL
      if ceilingTrace.Hit then
        ceilingHeight = (ceilingTrace.HitPos - startpos).z
        ceilingEntity = ceilingTrace.Entity
      end

      if not self:IsCrouching() then
        local shouldCrawl = false
        local reason = ""

        if ceilingHeight < 72 then
          if not IsValid(ceilingEntity) or not self:ShouldAvoidCrawling(ceilingEntity) then
            local sideClear = true
            local endpos = startpos + forw * traceDistance
            local leftTrace = util.TraceHull({ start = startpos + right * -crawlWidth, endpos = endpos + right * -crawlWidth, mins = standingMins, maxs = crouchingMaxs, filter = self })
            local rightTrace = util.TraceHull({ start = startpos + right * crawlWidth, endpos = endpos + right * crawlWidth, mins = standingMins, maxs = crouchingMaxs, filter = self })
            if leftTrace.Hit or rightTrace.Hit then sideClear = false end
            if sideClear then shouldCrawl = true reason = "low ceiling" end
          end
        end

        local endpos = startpos + forw * traceDistance
        local traceStanding = util.TraceHull({ start = startpos, endpos = endpos, mins = standingMins, maxs = standingMaxs, filter = self })
        if traceStanding.Hit then
          local hitEnt = traceStanding.Entity
          if not IsValid(hitEnt) or not self:ShouldAvoidCrawling(hitEnt) then
            local traceCrouching = util.TraceHull({ start = startpos, endpos = endpos, mins = standingMins, maxs = crouchingMaxs, filter = self })
            if not traceCrouching.Hit then
              local leftTrace = util.TraceHull({ start = startpos + right * -crawlWidth, endpos = endpos + right * -crawlWidth, mins = standingMins, maxs = crouchingMaxs, filter = self })
              local rightTrace = util.TraceHull({ start = startpos + right * crawlWidth, endpos = endpos + right * crawlWidth, mins = standingMins, maxs = crouchingMaxs, filter = self })
              if not leftTrace.Hit and not rightTrace.Hit then shouldCrawl = true reason = "obstacle in front" end
            end
          end
        end

        if shouldCrawl then
          self:ToCrouch()
          self:SetCooldown("AI_UnCrouch", 2)
        end
      else
        if self:GetCooldown("AI_UnCrouch") <= 0 and not self.IsKilling then
          local canStand = false
          if ceilingHeight >= 72 then
            local forwardTrace = util.TraceHull({ start = startpos, endpos = startpos + forw * 10, mins = standingMins, maxs = standingMaxs, filter = self })
            if not forwardTrace.Hit then canStand = true end
          end
          if canStand then self:UnCrouch() end
        end
      end
    end

    
    if not self:IsMoving() or not self:IsOnGround() then 
      self.LastFootstepCycle = 0
    else
      local sequence = self:GetSequenceName(self:GetSequence())
      local cycle = self:GetCycle()
      local currentTime = CurTime()
      
      if currentTime - self.LastFootstepTime >= 0.1 then
        if self.LastSequence != sequence then
          self.LastFootstepCycle = 0
          self.LastSequence = sequence
        end
        
        local shouldPlayFootstep = false
        
        if sequence == "walk" then
          if (self.LastFootstepCycle < 0.2 and cycle >= 0.2) or (self.LastFootstepCycle < 0.7 and cycle >= 0.7) then
            local walkSounds = {"dark/bon/bon_walkstep1.wav","dark/bon/bon_walkstep2.wav","dark/bon/bon_walkstep3.wav","dark/bon/bon_walkstep4.wav","dark/bon/bon_walkstep5.wav"}
            local volume = GetConVar("bon_sound_volume_walk"):GetInt()
            local pitch = GetConVar("bon_sound_pitch_walk"):GetInt()
            self:EmitSound(walkSounds[math.random(#walkSounds)], volume, pitch)
            shouldPlayFootstep = true
          end
        elseif sequence == "run" then
          if (self.LastFootstepCycle < 0.25 and cycle >= 0.25) or (self.LastFootstepCycle < 0.75 and cycle >= 0.75) then
            local runSounds = {"dark/bon/bon_runstep1.wav","dark/bon/bon_runstep2.wav","dark/bon/bon_runstep3.wav","dark/bon/bon_runstep4.wav"}
            local volume = GetConVar("bon_sound_volume_run"):GetInt()
            local pitch = GetConVar("bon_sound_pitch_run"):GetInt()
            self:EmitSound(runSounds[math.random(#runSounds)], volume, pitch)
            shouldPlayFootstep = true
          end
        elseif sequence == "CrawlMovement" then
          if (self.LastFootstepCycle < 0.3 and cycle >= 0.3) or (self.LastFootstepCycle < 0.8 and cycle >= 0.8) then
            local crawlSounds = {"dark/bon/bon_walkstep1.wav","dark/bon/bon_walkstep2.wav","dark/bon/bon_walkstep3.wav","dark/bon/bon_walkstep4.wav","dark/bon/bon_walkstep5.wav"}
            local volume = GetConVar("bon_sound_volume_crouch"):GetInt()
            local pitch = GetConVar("bon_sound_pitch_crouch"):GetInt()
            self:EmitSound(crawlSounds[math.random(#crawlSounds)], volume, pitch)
            shouldPlayFootstep = true
          end
        end
        
        if shouldPlayFootstep then self.LastFootstepTime = currentTime end
        self.LastFootstepCycle = cycle
      end
    end

    
    if self:IsPossessed() then
      self:DirectPoseParametersAt(self:PossessorTrace().HitPos, "aim_pitch", "aim_yaw", self:EyePos())
    elseif self:HasEnemy() and IsValid(self:GetEnemy()) then
      local enemy = self:GetEnemy()
      if enemy:GetClass() != "info_target" and self:HasDirectLineOfSight(enemy) then
        local targetPos = enemy:GetPos()
        if enemy.EyePos then targetPos = enemy:EyePos() end
        self:DirectPoseParametersAt(targetPos, "aim_pitch", "aim_yaw", self:EyePos())
      else
        local forwardPos = self:GetPos() + self:GetForward() * 200 + Vector(0, 0, 60)
        self:DirectPoseParametersAt(forwardPos, "aim_pitch", "aim_yaw", self:EyePos())
      end
    else
      
      local neutralPos = self:GetPos() + self:GetForward() * 200 + Vector(0, 0, 120)
      self:DirectPoseParametersAt(neutralPos, "aim_pitch", "aim_yaw", self:EyePos())
    end

    self:PropAttack()
    self:BreakGlass()
    self:HandleRagdollCollision()
    
    if !self:IsPossessed() and not self.InvestigatingSound and not self.IsStalking then
      local entstoattack = ents.FindInSphere(self:LocalToWorld(Vector(0,0,0)), 40)
      for _,v in pairs(entstoattack) do
        if not ( v:IsValid() ) then continue end
        if (v:IsPlayer() or v:IsNPC() or v:IsNextBot()) and v:Health() >= 0.1 then
          if v == self then continue end
          if self:ShouldIgnoreTarget(v) then continue end
          if v:IsPlayer() and v:Team() == TEAM_SPECTATOR then continue end
          if v:IsNextBot() and (v.IsDrGNextbot or v.Base == "drgbase_nextbot" or string.find(v:GetClass(), "drgbase")) then continue end
          if v:GetClass() == "info_target" then
            local vName = v:GetName() or ""
            if string.find(vName, "BonSoundTarget_") or string.find(vName, "BonStalkTarget_") then continue end
          end
          if IsValid(v) and IsValid(self) then
            if v:IsPlayer() and self.GrabbedEntity == nil and !IsValid(v.HideSpot) and not self.IsKilling then
              self:PerformJumpscare(v)
            elseif not v:IsPlayer() and not self.IsKilling then
              self:KillNPC(v)
            end
          end
        end
      end
    end
  end

  
  function ENT:NextbotNextbotJumpscarePlayer(ply, onStart, onFinish)
    if not IsValid(ply) or not ply:IsPlayer() then return end

    local puppet = self
    local entIndex = self:EntIndex() 

    
    ply:Freeze(true)
    ply:SetNWInt("DisableMovement_jumpscare_pill_bon", CurTime() + 9)
    
    ply:SetNWBool("BonLockView", true)
    ply:SetNWEntity("BonLockViewEntity", self)
    net.Start("bon_lock_player_view")
    net.WriteBool(true)
    net.WriteEntity(self)
    net.Send(ply)

    local useOverlay = GetConVar("bon_neckbreak_overlay"):GetBool()
    
    net.Start("bon_nextbot_jumpscare_gen")
    net.WriteEntity(puppet)
    net.WriteBool(true)
    net.WriteBool(useOverlay)
    net.Send(ply)

    if onStart then onStart() end

    self:CallInCoroutine(function(self)
      if not IsValid(self) then
        if IsValid(ply) then
          ply:Freeze(false)
          
          if ply._bonOrigMoveType then
            ply:SetMoveType(ply._bonOrigMoveType)
            ply._bonOrigMoveType = nil
          end
          ply:SetLocalVelocity(Vector(0, 0, 0))
          ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
          ply:SetNWBool("BonLockView", false)
          ply:SetNWEntity("BonLockViewEntity", NULL)
          ply:RemoveFlags(FL_NOTARGET)
          ply:DrawViewModel(true)
          net.Start("bon_lock_player_view")
          net.WriteBool(false)
          net.WriteEntity(ply)
          net.Send(ply)
          net.Start("bon_nextbot_jumpscare_cleanup")
          net.WriteEntity(puppet)
          net.WriteBool(false)
          net.Send(ply)
        end
        return
      end
      
      self:PlaySequenceAndMove("kill")
      
      if IsValid(ply) and IsValid(self) then
        
        self:StopKillEnforcement(ply)
        ply:TakeDamage(math.huge, self, self) 
        
        self:StopRagdollVelocity(ply)
        ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
        ply:SetNWBool("BonLockView", false)
        ply:SetNWEntity("BonLockViewEntity", NULL)
        net.Start("bon_lock_player_view")
        net.WriteBool(false)
        net.WriteEntity(self)
        net.Send(ply)
        net.Start("bon_nextbot_jumpscare_gen")
        net.WriteEntity(puppet)
        net.WriteBool(false)
        net.WriteBool(false)
        net.Send(ply)
        if onFinish then onFinish() end
      elseif IsValid(ply) then
        ply:Freeze(false)
        
        if ply._bonOrigMoveType then
          ply:SetMoveType(ply._bonOrigMoveType)
          ply._bonOrigMoveType = nil
        end
        ply:SetLocalVelocity(Vector(0, 0, 0))
        ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
        ply:SetNWBool("BonLockView", false)
        ply:SetNWEntity("BonLockViewEntity", NULL)
        ply:RemoveFlags(FL_NOTARGET)
        ply:DrawViewModel(true)
        net.Start("bon_lock_player_view")
        net.WriteBool(false)
        net.WriteEntity(ply)
        net.Send(ply)
        net.Start("bon_nextbot_jumpscare_cleanup")
        net.WriteEntity(puppet)
        net.WriteBool(false)
        net.Send(ply)
      end
    end)
  end

  
  
  
  
  hook.Add("StartCommand", "BonLockPlayerView_Server", function(ply, cmd)
    if not IsValid(ply) or not ply:IsPlayer() then return end
    if ply:GetNWBool("BonLockView", false) then
      cmd:SetMouseX(0)
      cmd:SetMouseY(0)
      cmd:SetViewAngles(ply:EyeAngles())
    end
  end)

  
  
  
  
  
  hook.Add("PlayerSpawn", "BonCleanupOnSpawn", function(ply)
    if not IsValid(ply) then return end
    
    
    ply._bonOrigMoveType = nil
    
    
    ply:Freeze(false)
    
    
    ply:SetNWBool("BonLockView", false)
    ply:SetNWEntity("BonLockViewEntity", NULL)
    ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
    
    
    net.Start("bon_lock_player_view")
    net.WriteBool(false)
    net.WriteEntity(ply)
    net.Send(ply)
    
    
    local plyIdx = ply:EntIndex()
    for _, ent in pairs(ents.FindByClass("npc_drgbase_thebonwalten")) do
      if IsValid(ent) then
        local hookName = "BonKillEnforce_" .. ent:EntIndex() .. "_" .. plyIdx
        hook.Remove("Think", hookName)
      end
    end
  end)

  
  
  
  
  hook.Add("CreateEntityRagdoll", "BonStopRagdollFling", function(owner, ragdoll)
    if not IsValid(ragdoll) then return end
    
    
    for _, bon in pairs(ents.FindByClass("npc_drgbase_thebonwalten")) do
      if IsValid(bon) and bon.IsKilling then
        local dist = ragdoll:GetPos():Distance(bon:GetPos())
        if dist < 200 then
          
          
          local function SoftZeroRagdoll()
            if not IsValid(ragdoll) then return end
            
            local phys = ragdoll:GetPhysicsObject()
            if IsValid(phys) then
              phys:SetVelocity(Vector(0, 0, -10))
              phys:SetAngleVelocity(Vector(0, 0, 0))
              phys:Wake()
            end
            
            for i = 0, ragdoll:GetPhysicsObjectCount() - 1 do
              local bone = ragdoll:GetPhysicsObjectNum(i)
              if IsValid(bone) then
                bone:SetVelocity(Vector(0, 0, -10))
                bone:SetAngleVelocity(Vector(0, 0, 0))
                bone:Wake()
              end
            end
          end
          
          
          SoftZeroRagdoll()
          
          
          for _, delay in ipairs({0, 0.01, 0.02, 0.03, 0.05}) do
            timer.Simple(delay, SoftZeroRagdoll)
          end
          
          break
        end
      end
    end
  end)

  hook.Add("SetupMove", "DisablePlayerMovement_bon", function(ply, mv, cmd)
    local blockTime = ply:GetNWInt("DisableMovement_jumpscare_pill_bon")
    if blockTime > 0 and blockTime >= CurTime() then
      
      
      mv:SetForwardSpeed(0)
      mv:SetSideSpeed(0)
      mv:SetUpSpeed(0)
      mv:SetButtons(0)
      mv:SetMaxClientSpeed(0)
      
      cmd:SetForwardMove(0)
      cmd:SetSideMove(0)
      cmd:SetUpMove(0)
    elseif blockTime > 0 and blockTime < CurTime() then
      ply:SetNWInt("DisableMovement_jumpscare_pill_bon", 0)
    end
  end)
end

if CLIENT then
  
  
  
  
  
  local bonViewLocked = false
  local bonLockEntity = NULL
  
  net.Receive("bon_lock_player_view", function()
    bonViewLocked = net.ReadBool()
    bonLockEntity = net.ReadEntity()
    
    if not bonViewLocked then
      bonLockEntity = NULL
    end
  end)
  
  hook.Add("CreateMove", "BonLockPlayerView_Client", function(cmd)
    if bonViewLocked then
      
      cmd:SetMouseX(0)
      cmd:SetMouseY(0)
      
      
      local ply = LocalPlayer()
      if IsValid(ply) and IsValid(bonLockEntity) then
        local dirToBon = (bonLockEntity:GetPos() - ply:GetPos())
        dirToBon.z = 0
        local facingAngle = dirToBon:Angle()
        facingAngle.p = 0
        facingAngle.r = 0
        cmd:SetViewAngles(facingAngle)
      end
    end
  end)

  net.Receive("bon_nextbot_jumpscare_gen", function()
    local ent = net.ReadEntity()
    local state = net.ReadBool()
    local useOverlay = net.ReadBool()
    local startTime = CurTime()

    local hookID = "sbon_nextbot_jumpscare_gen_" .. LocalPlayer():SteamID()
    local effectsHookID = "sbon_nextbot_jumpscare_effects_" .. LocalPlayer():SteamID()

    hook.Add("CalcView", hookID, function(ply, pos, angles, fov)
      if not IsValid(ply) or not ply:Alive() or not IsValid(ent) or not state or 
         (IsValid(ent) and ent:GetClass() != "npc_drgbase_thebonwalten") then
        hook.Remove("CalcView", hookID)
        hook.Remove("RenderScreenspaceEffects", effectsHookID)
        if IsValid(ply) then
          ply:RemoveFlags(FL_NOTARGET)
          ply:DrawViewModel(true)
        end
        return
      end

      local cam = ent:GetAttachment(ent:LookupAttachment("camera"))
      if not cam then 
        hook.Remove("CalcView", hookID)
        hook.Remove("RenderScreenspaceEffects", effectsHookID) 
        if IsValid(ply) then
          ply:RemoveFlags(FL_NOTARGET)
          ply:DrawViewModel(true)
        end
        return 
      end

      ply:AddFlags(FL_NOTARGET)
      ply:DrawViewModel(false)

      local lerpFactor = math.Clamp((CurTime() - startTime) / 0.7, 0, 1)
      local targetFOV = 60 

      local view = {
        origin = LerpVector(lerpFactor, pos, cam.Pos),
        angles = LerpAngle(lerpFactor, angles, cam.Ang),
        fov = Lerp(lerpFactor, fov, targetFOV),
        drawviewer = false
      }
      return view
    end)

    if useOverlay then
      hook.Add("RenderScreenspaceEffects", effectsHookID, function()
        if not IsValid(ent) or not state then
          hook.Remove("RenderScreenspaceEffects", effectsHookID)
          return
        end

        local timeSinceStart = CurTime() - startTime
        
        if timeSinceStart >= 3.25 then
          local effectTime = timeSinceStart - 3.25 
          
          if effectTime <= 0.1 then
            local flashIntensity = 1 - (effectTime / 0.1) 
            DrawColorModify({
              ["$pp_colour_brightness"] = flashIntensity * 0.3,
              ["$pp_colour_contrast"] = 1 + flashIntensity * 0.5,
              ["$pp_colour_colour"] = 1,
              ["$pp_colour_addr"] = flashIntensity * 0.8, 
              ["$pp_colour_addg"] = 0,
              ["$pp_colour_addb"] = 0,
              ["$pp_colour_mulr"] = 1 + flashIntensity * 0.5,
              ["$pp_colour_mulg"] = 1 - flashIntensity * 0.3,
              ["$pp_colour_mulb"] = 1 - flashIntensity * 0.3
            })
          else
            local constantIntensity = 0.8 
            DrawMotionBlur(0.15, constantIntensity * 0.9, 0.01)
            DrawColorModify({
              ["$pp_colour_brightness"] = -constantIntensity * 0.25,
              ["$pp_colour_contrast"] = 1 + constantIntensity * 0.4,
              ["$pp_colour_colour"] = 1 - constantIntensity * 0.7, 
              ["$pp_colour_addr"] = constantIntensity * 0.15,
              ["$pp_colour_addg"] = 0,
              ["$pp_colour_addb"] = 0,
              ["$pp_colour_mulr"] = 1 + constantIntensity * 0.15,
              ["$pp_colour_mulg"] = 1 - constantIntensity * 0.2,
              ["$pp_colour_mulb"] = 1 - constantIntensity * 0.2
            })
            DrawBloom(0.7, constantIntensity * 2.2, 9, 9, 1, 1, 1, 1, 1)
          end
        end
      end)
    end
  end)

  net.Receive("bon_nextbot_jumpscare_cleanup", function()
    local ent = net.ReadEntity()
    local state = net.ReadBool()
    
    local hookID = "sbon_nextbot_jumpscare_gen_" .. LocalPlayer():SteamID()
    local effectsHookID = "sbon_nextbot_jumpscare_effects_" .. LocalPlayer():SteamID()
    
    hook.Remove("CalcView", hookID)
    hook.Remove("RenderScreenspaceEffects", effectsHookID)
    
    local ply = LocalPlayer()
    if IsValid(ply) then
      ply:RemoveFlags(FL_NOTARGET)
      ply:DrawViewModel(true)
    end
    
    
    bonViewLocked = false
    bonLockEntity = NULL
  end)

  net.Receive("bon_nextbot_emergency_cleanup", function()
    local ent = net.ReadEntity()
    local ply = LocalPlayer()
    local hookID = "sbon_nextbot_jumpscare_gen_" .. ply:SteamID()
    local effectsHookID = "sbon_nextbot_jumpscare_effects_" .. ply:SteamID()
    
    hook.Remove("CalcView", hookID)
    hook.Remove("RenderScreenspaceEffects", effectsHookID)
    
    if IsValid(ply) then
      ply:RemoveFlags(FL_NOTARGET)
      ply:DrawViewModel(true)
    end
    
    
    bonViewLocked = false
    bonLockEntity = NULL
  end)
end

if SERVER then
  local camera_id = 0

  function ENT:CreateCCTVCamera()
    if not IsValid(self) then return end
    if not weapons.Get("ca_tablet") then return end
    
    if not GetConVar("bon_ca_camera"):GetBool() then return end
    
    camera_id = camera_id + 1
    
    local ca_camera = ents.Create("ca_camera")
    if not IsValid(ca_camera) then return end
    
    local headBone = self:LookupBone("Head")
    
    ca_camera:SetRenderMode(RENDERMODE_NONE)
    ca_camera:SetNoDraw(true)
    ca_camera:DrawShadow(false)
    ca_camera:SetCameraName("BON_VISION_" .. camera_id)
    ca_camera:SetPos(self:GetPos())
    ca_camera:SetAngles(self:GetAngles())
    ca_camera:Spawn()
    ca_camera:SetCollisionGroup(COLLISION_GROUP_DEBRIS)
    ca_camera:SetSolid(SOLID_NONE)
    
    if headBone and headBone >= 0 then
      ca_camera:FollowBone(self, headBone)
      ca_camera:AddEffects(EF_FOLLOWBONE)
      ca_camera:SetLocalPos(Vector(5, 10, -10))
      ca_camera:SetLocalAngles(Angle(90, 180, 90))
    else
      ca_camera:SetParent(self)
      ca_camera:SetLocalPos(Vector(5, 0, 65))
      ca_camera:SetLocalAngles(Angle(90, 180, 90))
    end
    
    self.CCTVCamera = ca_camera
    self.CameraID = camera_id
    
    timer.Simple(0.5, function()
      for _, ply in pairs(player.GetAll()) do
        if IsValid(ply) then ply:ConCommand("ca_cams_sync_server") end
      end
    end)
    
    return ca_camera
  end
  
  function ENT:RemoveCCTVCamera()
    if IsValid(self.CCTVCamera) then
      self.CCTVCamera:Remove()
      self.CCTVCamera = nil
      self.CameraID = nil
      timer.Simple(0.1, function()
        for _, ply in pairs(player.GetAll()) do
          if IsValid(ply) then ply:ConCommand("ca_cams_sync_server") end
        end
      end)
    end
  end
  
  function ENT:CustomInitialize()
    self.Parts = {"Hand.L", "Hand.R", "Foot.L", "Foot.R", "UpperArm.L", "UpperArm.R"}
    self.SeenEntities = {}
    self.CheckingLocker = false
    self.ChasingSound = false
    self:SetCooldown("Sound", 2)
    self.PosToGo = Vector()
    self:SetDefaultRelationship(D_HT)

    self.AmbientLight = self:DynamicLight(Color(255, 255, 255, 0), 80, 0.6, 4, 0)
    self.AmbientLight:FollowBone(self, self:LookupBone("Head"))
    self.AmbientLight:SetLocalPos(Vector(0, 0, 0))

    self.IsKilling = false
    
    self.LastPosition = self:GetPos()
    self.StuckTime = 0
    self.StuckCheckInterval = 1
    self.MaxStuckTime = 3
    self.LastStuckCheck = CurTime()
    self.CompleteStuckTime = 0
    self.EnemyStuckTime = 0
    self.PatrolStuckTime = 0
    self.SoundChaseStuckTime = 0
    self.StalkStuckTime = 0
    self.LastVelocityCheck = CurTime()
    self.VelocityStuckTime = 0
    self.MaxVelocityStuckTime = 3
    self.LastAngles = self:GetAngles()
    self.OnlyHeadMovingTime = 0
    self.MaxHeadOnlyTime = 3
    
    self.SoundState = "none"
    self.NextChaseSoundTime = 0
    self.NextIdleSoundTime = 0

    self.SoundVolumes = { walk = 67, run = 67, crouch = 70, idle = 100, jumpscare = 100 }
    self.SoundPitches = { walk = 100, run = 100, crouch = 100, idle = 100, jumpscare = 100 }
    
    self.SightRange = GetConVar("bon_sight_range") and GetConVar("bon_sight_range"):GetInt() or 2000
    self.LoseRange = GetConVar("bon_lose_range") and GetConVar("bon_lose_range"):GetInt() or 3000
    self.SoundRange = GetConVar("bon_sound_range") and GetConVar("bon_sound_range"):GetInt() or 4000
    self.SpotDuration = 4.5
    
    self:UpdateSpeedsFromConVars()
    
    self.LastFootstepCycle = 0
    self.LastSequence = ""
    self.LastFootstepTime = 0
    
    self.InvestigatingSound = false
    self.SoundInvestigationComplete = false
    self.SoundInvestigationStartTime = nil
    
    self.IsStalking = false
    self.StalkStartTime = nil
    self.StalkLastKnownPos = nil
    self.StalkSearchIndex = 0
    self.StalkCurrentTarget = nil
    self.StalkTargetEnt = nil
    self.LastKnownEnemyPos = nil
    self.NoLOSTime = 0
    
    self.IsLookingAround = false
    self.LookAroundDirection = nil
    self.LookAroundStartTime = nil
    self.LookAroundTotalDuration = 8.0
    self.LookAroundSpinSpeed = 50.0
    self.LookAroundYaw = nil
    self.LookAroundLastUpdateTime = nil
    
    print("[BON DEBUG] Bon initialized v17.0 - Think hook + Freeze + NOCLIP + Lerp SetPos for players")
    
    timer.Simple(0.2, function() 
      if IsValid(self) then self:CreateCCTVCamera() end
    end)
    
    timer.Create("BonSoundSystem_" .. self:EntIndex(), 0.1, 0, function()
      if IsValid(self) then self:UpdateSoundSystem()
      else timer.Remove("BonSoundSystem_" .. self:EntIndex()) end
    end)
    
    timer.Create("BonSpeedUpdate_" .. self:EntIndex(), 5, 0, function()
      if IsValid(self) then self:UpdateSpeedsFromConVars()
      else timer.Remove("BonSpeedUpdate_" .. self:EntIndex()) end
    end)
    
    timer.Create("BonCameraWatch_" .. self:EntIndex(), 2, 0, function()
      if not IsValid(self) then 
        timer.Remove("BonCameraWatch_" .. self:EntIndex()) 
        return 
      end
      
      local cameraEnabled = GetConVar("bon_ca_camera"):GetBool()
      if cameraEnabled and not IsValid(self.CCTVCamera) then
        self:CreateCCTVCamera()
      elseif not cameraEnabled and IsValid(self.CCTVCamera) then
        self:RemoveCCTVCamera()
      end
    end)
  end

  function ENT:OnRemove()
    self:StopAllBonSoundsIncludingKill()
    self:RemoveCCTVCamera()
    self:CleanupAllJumpscares()
    self:ResetSoundInvestigation()
    if self.IsStalking then self:StopStalking() end
    
    timer.Remove("BonSoundSystem_" .. self:EntIndex())
    timer.Remove("BonSpeedUpdate_" .. self:EntIndex())
    timer.Remove("BonCameraWatch_" .. self:EntIndex())
    
    net.Start("bon_nextbot_emergency_cleanup")
    net.WriteEntity(self)
    net.Broadcast()
  end
end

if SERVER then
  util.AddNetworkString("bon_nextbot_jumpscare_gen")
  util.AddNetworkString("bon_nextbot_jumpscare_cleanup")
  util.AddNetworkString("bon_nextbot_emergency_cleanup")
  util.AddNetworkString("bon_lock_player_view")
end

if SERVER then
  AddCSLuaFile()
end

DrGBase.AddNextbot(ENT)