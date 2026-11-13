local lshift = bit.lshift
local band = bit.band
local bor = bit.bor

local sp = game.SinglePlayer()
local CurTime = CurTime

--[[
Function Name:  ResetEvents
Syntax: self:ResetEvents()
Returns:  Nothing.
Purpose:  Cleans up events table.
]]--
function SWEP:ResetEvents()
	self:SetEventStatus1(0x00000000)
	self:SetEventStatus2(0x00000000)
	self:SetEventStatus3(0x00000000)
	self:SetEventStatus4(0x00000000)
	self:SetEventStatus5(0x00000000)
	self:SetEventStatus6(0x00000000)
	self:SetEventStatus7(0x00000000)
	self:SetEventStatus8(0x00000000)

	self:SetEventTimer(CurTime())
	-- self:SetFirstDeployEvent(false)

	if self.EventTable then
		for _, eventtable in pairs(self.EventTable) do
			for i = 1, #eventtable do
				eventtable[i].called = false
			end
		end
	end

	if self.event_table_overflow then
		local editcts = self.EventTableEdict

		if editcts[0] then
			editcts[0].called = false

			for i = 1, #editcts do
				editcts[i].called = false
			end
		end
	end

	if sp then
		self:CallOnClient("ResetEvents", "")
	end
end

function SWEP:GetEventPlayed(event_slot)
	if self.event_table_overflow then
		return assert(self.EventTableEdict[event_slot], string.format("Unknown event %d", event_slot)).called
	end

	local inner_index = event_slot % 32
	local outer_index = (event_slot - inner_index) / 32 + 1
	local lindex = lshift(1, inner_index)
	return band(self.get_event_status_lut[outer_index](self), lindex) ~= 0, inner_index, outer_index, lindex
end

function SWEP:SetEventPlayed(event_slot)
	if self.event_table_overflow then
		assert(self.EventTableEdict[event_slot], string.format("Unknown event %d", event_slot)).called = true
		return
	end

	local inner_index = event_slot % 32
	local outer_index = (event_slot - inner_index) / 32 + 1
	local lindex = lshift(1, inner_index)

	self.set_event_status_lut[outer_index](self, bor(self.get_event_status_lut[outer_index](self), lindex))
	return inner_index, outer_index, lindex
end

--[[
Function Name:  ProcessEvents
Syntax: self:ProcessEvents().
Returns:  Nothing.
Notes: Critical for the event table to function.
Purpose:  Main SWEP function
]]--

SWEP._EventSlotCount = 0
SWEP.EventTableEdict = {}

function SWEP:DispatchEvent(arg)
	if not self.event_table_built then
		self:RebuildEventEdictTable()
	end

	local event = assert(self.EventTableEdict[tonumber(arg)], "No such event with edict " .. arg)

	if self.EventHandlers[event.type] and type(self.EventHandlers[event.type]) == "function" then
		self.EventHandlers[event.type](self, self:VMIVNPC(), event)
	end
end

function SWEP:DispatchLuaEvent(arg)
	if not self.event_table_built then
		self:RebuildEventEdictTable()
	end

	local fn = assert(assert(self.EventTableEdict[tonumber(arg)], "No such event with edict " .. arg).value, "Event is missing a function to call")
	assert(isfunction(fn), "Event " .. arg .. " is not a Lua event")
	fn(self, self:VMIV(), true)
end

function SWEP:DispatchBodygroupEvent(arg)
	if not self.event_table_built then
		self:RebuildEventEdictTable()
	end

	local event = assert(self.EventTableEdict[tonumber(arg)], "No such event with edict " .. arg)
	assert(isstring(event.name), "Event " .. arg .. " is missing bodygroup name to set")
	assert(isstring(event.value), "Event " .. arg .. " is missing bodygroup value to set")

	if event.view then
		self.ViewModelBodygroups[event.name] = event.value
	end

	if event.world then
		self.WorldModelBodygroups[event.name] = event.value
	end
end

local isstring = isstring

local function eventtablesorter(a, b)
	local sa, sb = isstring(a), isstring(b)

	if sa and not sb or not sa and sb then
		if sa then
			return false
		end

		return true
	end

	return a < b
end

function SWEP:RebuildEventEdictTable()
	local self2 = self:GetTable()
	local slot = 0

	for i = #self2.EventTableEdict, 0, -1 do
		self2.EventTableEdict[i] = nil
	end

	self:ResetEvents()

	local eventtable = self2.EventTable
	eventtable.BaseClass = nil

	local keys = table.GetKeys(eventtable)
	table.sort(keys, eventtablesorter)

	for _, key in ipairs(keys) do
		local value = eventtable[key]

		if istable(value) then
			for _, event in SortedPairs(value) do
				if istable(event) then
					event.slot = slot
					slot = slot + 1

					if not event.autodetect then
						if event.type == "lua" then
							if event.server == nil then
								event.server = true
							end
						elseif event.type == "snd" or event.type == "sound" then
							if event.server == nil then
								event.server = false
							end
						elseif event.type == "bg" or event.type == "bodygroup" then
							if event.server == nil then event.server = true end
							if event.view == nil then event.view = true end
							if event.world == nil then event.world = true end
						end

						if event.client == nil then
							event.client = true
						end

						event.autodetect = true
					end

					event.called = false

					if slot > 256 and not self.event_table_warning then
						ErrorNoHalt("[TFA Base] Weapon " .. self:GetClass() .. " got too many events! 256 is maximum! Event table would NOT be properly predicted this time!\n")
						self.event_table_warning = true
					end

					self2.EventTableEdict[event.slot] = event
				end
			end
		end
	end

	self.event_table_overflow = slot > 256
	self._built_event_debug_string_fn = nil

	self._EventSlotCount = math.ceil(slot / 32)
	self._EventSlotNum = slot - 1
	self.event_table_built = true
end

SWEP.EventHandlers = {
	["lua"] = function(self, viewmodel, event, firstprediction)
		local ply = self:GetOwner()
		local is_local = CLIENT and ply == LocalPlayer()

		if ((event.client and CLIENT and (not event.client_predictedonly or is_local)) or (event.server and SERVER)) and event.value then
			event.value(self, viewmodel, firstprediction)
		end
	end,
	["sound"] = function(self, viewmodel, event, firstprediction)
		local ply = self:GetOwner()
		local isplayer = ply:IsPlayer()

		local is_local = CLIENT and ply == LocalPlayer()

		if SERVER then
			if event.client then
				if not isplayer and player.GetCount() ~= 0 then
					net.Start("tfaSoundEvent", true)
					net.WriteEntity(self)
					net.WriteString(event.value or "")
					net.SendPVS(self:GetPos())
				elseif isplayer then
					net.Start("tfaSoundEvent", true)
					net.WriteEntity(self)
					net.WriteString(event.value or "")
					net.SendOmit(ply)
				end
			elseif event.server and event.value and event.value ~= "" then
				self:EmitSound(event.value)
			end
		elseif event.client and is_local and event.value and event.value ~= "" then
			if firstprediction or firstprediction == nil then
				if event.time <= 0.01 then
					self:EmitSoundSafe(event.value)
				else
					self:EmitSound(event.value)
				end
			end
		end
	end,
	["bodygroup"] = function(self, viewmodel, event, firstprediction)
		local ply = self:GetOwner()

		local is_local = CLIENT and ply == LocalPlayer()

		if ((event.client and CLIENT and (not event.client_predictedonly or is_local)) or
			(event.server and SERVER)) and (event.name and event.value and event.value ~= "") then

			if event.view then
				self.ViewModelBodygroups[event.name] = event.value
			end

			if event.world then
				self.WorldModelBodygroups[event.name] = event.value
			end
		end
	end,
	-- ["custom_event_name"] = function(self, viewmodel, event, firstprediction)
	-- end
}

SWEP.EventHandlers["snd"] = SWEP.EventHandlers["sound"]
SWEP.EventHandlers["bg"] = SWEP.EventHandlers["bodygroup"]

function SWEP:ProcessEvents(firstprediction)
	local viewmodel = self:VMIVNPC()
	if not viewmodel then return end

	if not self.event_table_built then
		self:RebuildEventEdictTable()
	end

	if sp and CLIENT then return end
	if sp and SERVER then return self:ProcessEventsSP() end

	local ply = self:GetOwner()
	local isplayer = ply:IsPlayer()

	local evtbl = self.EventTable[self:GetLastActivity() or -1] or self.EventTable[viewmodel:GetSequenceName(viewmodel:GetSequence())]
	if not evtbl then return end

	local curtime = CurTime()
	local eventtimer = self:GetEventTimer()
	local is_local = CLIENT and ply == LocalPlayer()
	local animrate = self:GetAnimationRate(self:GetLastActivity() or -1)

	self.current_event_iftp = firstprediction
	self.processing_events = true

	for i = 1, #evtbl do
		local event = evtbl[i]
		if self:GetEventPlayed(event.slot) or curtime < eventtimer + event.time / animrate then goto CONTINUE end
		self:SetEventPlayed(event.slot)
		event.called = true

		if not event.autodetect then
			if event.type == "lua" then
				if event.server == nil then
					event.server = true
				end
			elseif event.type == "snd" or event.type == "sound" then
				if event.server == nil then
					event.server = false
				end
			elseif event.type == "bg" or event.type == "bodygroup" then
				if event.server == nil then event.server = true end
				if event.view == nil then event.view = true end
				if event.world == nil then event.world = true end
			end

			if event.client == nil then
				event.client = true
			end

			event.autodetect = true
		end

		if self.EventHandlers[event.type] and type(self.EventHandlers[event.type]) == "function" then
			if (SERVER and event.server) or (event.client and (not event.client_predictedonly or is_local)) then
				self.EventHandlers[event.type](self, viewmodel, event, firstprediction)
			end
		end

		::CONTINUE::
	end

	self.processing_events = false
	self.current_event_iftp = nil
end

-- This function is exclusively targeting singleplayer
function SWEP:ProcessEventsSP(firstprediction)
	local viewmodel = self:VMIVNPC()
	if not viewmodel then return end

	local evtbl = self.EventTable[self:GetLastActivity() or -1] or self.EventTable[viewmodel:GetSequenceName(viewmodel:GetSequence())]
	if not evtbl then return end

	local curtime = CurTime()
	local eventtimer = self:GetEventTimer()
	local is_local = self:GetOwner() == Entity(1)
	local animrate = self:GetAnimationRate(self:GetLastActivity() or -1)

	self.processing_events = true

	for i = 1, #evtbl do
		local event = evtbl[i]
		if self:GetEventPlayed(event.slot) or curtime < eventtimer + event.time / animrate then goto CONTINUE end
		self:SetEventPlayed(event.slot)
		event.called = true

		if not event.autodetect then
			if event.type == "lua" then
				if event.server == nil then
					event.server = true
				end
			elseif event.type == "snd" or event.type == "sound" then
				if event.server == nil then
					event.server = false
				end
			elseif event.type == "bg" or event.type == "bodygroup" then
				if event.server == nil then event.server = true end
				if event.view == nil then event.view = true end
				if event.world == nil then event.world = true end
			end

			if event.client == nil then
				event.client = true
			end

			event.autodetect = true
		end

		if self.EventHandlers[event.type] and type(self.EventHandlers[event.type]) == "function" then
			if event.server then
				self.EventHandlers[event.type](self, viewmodel, event, firstprediction)
			end

			if event.client and (not event.client_predictedonly or is_local) then
				self:CallOnClient("DispatchEvent", tostring(event.slot))
			end
		end

		::CONTINUE::
	end

	self.processing_events = false
end

function SWEP:EmitSoundSafe(snd)
	timer.Simple(0, function()
		if IsValid(self) and snd then self:EmitSound(snd) end
	end)
end

local STATUS_IDLE = TFA.GetStatus("idle")
local STATUS_HOLSTER = TFA.GetStatus("holster")
local STATUS_HOLSTER_FINAL = TFA.GetStatus("holster_final")
local STATUS_HOLSTER_READY = TFA.GetStatus("holster_ready")
local STATUS_RELOADING = TFA.GetStatus("reloading")
local STATUS_RELOADING_WAIT = TFA.GetStatus("reloading_wait")

local STATUS_RELOADING_LOOP_START = TFA.GetStatus("reloading_loop_start")
local STATUS_RELOADING_LOOP_START_EMPTY = TFA.GetStatus("reloading_loop_start_empty")
local STATUS_RELOADING_LOOP = TFA.GetStatus("reloading_loop")
local STATUS_RELOADING_LOOP_END = TFA.GetStatus("reloading_loop_end")

local STATUS_SHOOTING = TFA.GetStatus("shooting")
local STATUS_SILENCER_TOGGLE = TFA.GetStatus("silencer_toggle")
local STATUS_FIDGET = TFA.GetStatus("fidget")

local STATUS_PUMP = TFA.GetStatus("pump")

function SWEP:ProcessStatus()
	local self2 = self:GetTable()

	local is = self2.GetIronSights(self)
	local spr = self2.GetSprinting(self)
	local wlk = self2.GetWalking(self)
	local cst = self2.GetCustomizing(self)

	-- local ply = self:GetOwner()
	-- local isplayer = ply:IsPlayer()

	local stat = self2.GetStatus(self)
	local statend = self2.GetStatusEnd(self)

	local is_raw = self2.GetIronSightsRaw(self)
	if stat == STATUS_FIDGET and is_raw then
		self2.SetStatusEnd(self, 0)

		self2.Idle_Mode_Old = self2.Idle_Mode
		self2.Idle_Mode = TFA.Enum.IDLE_BOTH
		self2.ClearStatCache(self, "Idle_Mode")
		self2.ChooseIdleAnim(self)

		if sp then
			self:CallOnClient("ChooseIdleAnim", "")
		end

		self2.Idle_Mode = self2.Idle_Mode_Old
		self2.ClearStatCache(self, "Idle_Mode")
		self2.Idle_Mode_Old = nil
		statend = -1
	end

	local ct = CurTime()

	if stat ~= STATUS_IDLE and ct > statend then
		self2.SetFirstDeployEvent(self, false)
		local finalstat = STATUS_IDLE

		--Holstering
		if stat == STATUS_HOLSTER then
			finalstat = STATUS_HOLSTER_READY
			self2.SetStatusEnd(self, ct)
		elseif stat == STATUS_HOLSTER_READY then
			self2.FinishHolster(self)
			finalstat = STATUS_HOLSTER_FINAL
			self2.SetStatusEnd(self, ct + 0.6)
		elseif stat == STATUS_RELOADING_LOOP_START_EMPTY then
			--Shotgun Reloading from empty
			if not self2.IsJammed(self) then
				self2.InsertPrimaryAmmo(self, self2.GetStatL(self, "LoopedReloadInsertAmount", 1))
			end

			if self2.Ammo1(self) <= 0 or self:Clip1() >= self:GetPrimaryClipSize() or self2.GetReloadLoopCancel(self) then
				finalstat = STATUS_RELOADING_LOOP_END
				local _, tanim, ttype = self2.ChooseShotgunPumpAnim(self)
				self2.SetStatusEnd(self, ct + self2.GetActivityLength(self, tanim, false, ttype))
				self2.SetReloadLoopCancel(self, false)

				if not self2.GetReloadLoopCancel(self) then
					self2.SetJammed(self, false)
				end
			else
				local lact = self2.GetLastActivity(self)
				local waittime = self2.GetActivityLength(self, lact, false) - self2.GetActivityLength(self, lact, true)

				if waittime > 0.01 then
					finalstat = STATUS_RELOADING_WAIT
					self2.SetStatusEnd(self, ct + waittime)
				else
					finalstat = self2.LoadShell(self)
				end

				self2.SetJammed(self, false)
				--finalstat = self2.LoadShell(self)
				--self2.SetStatusEnd(self,  self:GetNextPrimaryFire() )
			end
		elseif stat == STATUS_RELOADING_LOOP_START then
			--Shotgun Reloading
			finalstat = self2.LoadShell(self)
		elseif stat == STATUS_RELOADING_LOOP then
			self2.InsertPrimaryAmmo(self, self2.GetStatL(self, "LoopedReloadInsertAmount", 1))
			local lact = self2.GetLastActivity(self)
			local waittime = 0

			if self2.GetActivityLength(self, lact, true) < self2.GetActivityLength(self, lact, false) - 0.01 then
				local sht = self2.GetStatL(self, "LoopedReloadInsertTime")

				if sht then
					sht = sht / self2.GetAnimationRate(self, ACT_VM_RELOAD)
				end

				waittime = (sht or self2.GetActivityLength(self, lact, false)) - self2.GetActivityLength(self, lact, true)
			end

			if waittime > 0.01 then
				finalstat = STATUS_RELOADING_WAIT
				self2.SetStatusEnd(self, ct + waittime)
			else
				if self2.Ammo1(self) <= 0 or self:Clip1() >= self:GetPrimaryClipSize() or self2.GetReloadLoopCancel(self) then
					finalstat = STATUS_RELOADING_LOOP_END
					local _, tanim, ttype = self2.ChooseShotgunPumpAnim(self)
					self2.SetStatusEnd(self, ct + self2.GetActivityLength(self, tanim, false, ttype))
					self2.SetReloadLoopCancel(self, false)
				else
					finalstat = self2.LoadShell(self)
				end
			end
		elseif stat == STATUS_RELOADING then
			self2.CompleteReload(self)
			local lact = self2.GetLastActivity(self)
			local waittime = self2.GetActivityLength(self, lact, false) - self2.GetActivityLength(self, lact, true)

			if waittime > 0.01 then
				finalstat = STATUS_RELOADING_WAIT
				self2.SetStatusEnd(self, ct + waittime)
			end
		elseif stat == STATUS_SILENCER_TOGGLE then
			--self2.SetStatusEnd(self,  self:GetNextPrimaryFire() )
			self2.SetSilenced(self, not self2.GetSilenced(self))
			self2.Silenced = self2.GetSilenced(self)
		elseif stat == STATUS_RELOADING_WAIT and self2.GetStatL(self, "LoopedReload") then
			if self2.Ammo1(self) <= 0 or self:Clip1() >= self:GetPrimaryClipSize() or self2.GetReloadLoopCancel(self) then
				finalstat = STATUS_RELOADING_LOOP_END
				local _, tanim, ttype = self2.ChooseShotgunPumpAnim(self)
				self2.SetStatusEnd(self, ct + self2.GetActivityLength(self, tanim, false, ttype))
				--self2.SetReloadLoopCancel( self, false )
			else
				finalstat = self2.LoadShell(self)
			end
		elseif stat == STATUS_RELOADING_LOOP_END and self2.GetStatL(self, "LoopedReload") then
			self2.SetReloadLoopCancel(self, false)
		elseif self2.GetStatL(self, "PumpAction") and stat == STATUS_PUMP then
			self2.SetReloadLoopCancel(self, false)
		elseif stat == STATUS_SHOOTING and self2.GetStatL(self, "PumpAction") then
			if self:Clip1() == 0 and self2.GetStatL(self, "PumpAction").value_empty then
				--finalstat = STATUS_PUMP_READY
				self2.SetReloadLoopCancel(self, true)
			elseif (self2.GetStatL(self, "Primary.ClipSize") < 0 or self:Clip1() > 0) and self2.GetStatL(self, "PumpAction").value then
				--finalstat = STATUS_PUMP_READY
				self2.SetReloadLoopCancel(self, true)
			end
		end

		--self2.SetStatusEnd(self,  math.huge )
		self2.SetStatus(self, finalstat)

		local sightsMode = self2.GetStatL(self, "Sights_Mode")
		local sprintMode = self2.GetStatL(self, "Sprint_Mode")
		local walkMode = self2.GetStatL(self, "Walk_Mode")
		local customizeMode = self2.GetStatL(self, "Customize_Mode")

		local smi = sightsMode ~= TFA.Enum.LOCOMOTION_LUA
		local spi = sprintMode ~= TFA.Enum.LOCOMOTION_LUA
		local wmi = walkMode ~= TFA.Enum.LOCOMOTION_LUA
		local cmi = customizeMode ~= TFA.Enum.LOCOMOTION_LUA

		if
			not TFA.Enum.ReadyStatus[stat] and
			stat ~= STATUS_SHOOTING and
			stat ~= STATUS_PUMP and
			finalstat == STATUS_IDLE and
			((smi or spi) or (cst and cmi))
		then
			if (is and smi) or (spr and spi) or (wlk and wmi) or (cst and cmi) then
				local success, _ = self2.Locomote(self, is and smi, is, spr and spi, spr, wlk and wmi, wlk, cst and cmi, cst)

				if success == false then
					self2.SetNextIdleAnim(self, -1)
				else
					self2.SetNextIdleAnim(self, math.max(self2.GetNextIdleAnim(self), ct + 0.1))
				end
			end
		end

		self2.LastBoltShoot = nil

		if self2.GetBurstCount(self) > 0 then
			if finalstat ~= STATUS_SHOOTING and finalstat ~= STATUS_IDLE then
				self2.SetBurstCount(self, 0)
			elseif self2.GetBurstCount(self) < self2.GetMaxBurst(self) and self:Clip1() > 0 then
				self:PrimaryAttack()
			else
				self2.SetBurstCount(self, 0)
				self:SetNextPrimaryFire(self2.GetNextCorrectedPrimaryFire(self, self2.GetBurstDelay(self)))
			end
		end
	end

	--if stat == STATUS_IDLE and self2.GetReloadLoopCancel(self) and (self2.GetStatL(self, "AllowSprintAttack") or self2.GetSprintProgress(self) < 0.1) then
	if stat == STATUS_IDLE and self2.GetReloadLoopCancel(self) then
		if self2.GetStatL(self, "PumpAction") then
			if ct > self:GetNextPrimaryFire() and not self2.KeyDown(self, IN_ATTACK) then
				self2.DoPump(self)
			end
		else
			self2.SetReloadLoopCancel(self, false)
		end
	end
end
