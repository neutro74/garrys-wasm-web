local IsValid = IsValid

-- stencil functions
local useStencils = render.SupportsPixelShaders_2_0() and render.SupportsVertexShaders_2_0()
local stencilMask = 68 -- common value proposed by gshader

-- https://wiki.facepunch.com/gmod/render_stencils#examplemakinganimpossiblespace
local function defineCanvas()
	render.SetStencilEnable(true)
	render.SetStencilWriteMask(stencilMask)
	render.SetStencilTestMask(stencilMask)
	render.SetStencilReferenceValue(0)
	render.SetStencilCompareFunction(STENCILCOMPARISONFUNCTION_ALWAYS)
	render.SetStencilFailOperation(STENCILOPERATION_REPLACE)
	render.SetStencilZFailOperation(STENCILOPERATION_REPLACE)
	render.SetStencilPassOperation(STENCILOPERATION_REPLACE)
	render.PerformFullScreenStencilOperation()

	render.SetStencilPassOperation(STENCILOPERATION_KEEP)
	render.SetStencilZFailOperation(STENCILOPERATION_KEEP)

	-- Use a dedicated stencil bit as the opening mask
	render.SetStencilReferenceValue(stencilMask)

	-- We only care about the Depth Test right now, so don't bother with the compare function
	render.SetStencilCompareFunction(STENCILCOMPARISONFUNCTION_ALWAYS)

	-- Start creating the opening mask
	render.SetStencilPassOperation(STENCILOPERATION_REPLACE)
end

local function drawOn()
	-- Don't modify the mask now that it's created
	render.SetStencilFailOperation(STENCILOPERATION_KEEP)

	-- We now want to only draw where the mask is set (Stencil Buffer values match the Reference Value)
	render.SetStencilCompareFunction(STENCILCOMPARISONFUNCTION_EQUAL)
end

local function stopCanvas()
	render.SetStencilEnable(false)
end

-- main draw functions
local CachedMaterials = {}

local DrawFunctions = {}
TFA.SightDrawFunctions = DrawFunctions

do -- Flat reticle, stays at center or moves with recoil
	local function ScreenScaleH(num)
		return num * (ScrH() / 480)
	end

	DrawFunctions[TFA.Enum.RETICLE_FLAT] = function(vm, ply, wep, SightElementTable)
		local ReticleMaterial = wep:GetStatL("StencilSight_ReticleMaterial")
		if not ReticleMaterial then return end

		if type(ReticleMaterial) == "string" then
			CachedMaterials[ReticleMaterial] = CachedMaterials[ReticleMaterial] or Material(ReticleMaterial, "noclamp nocull smooth")
			ReticleMaterial = CachedMaterials[ReticleMaterial]
		end

		local ReticleSize = wep:GetStatL("StencilSight_ReticleSize")
		if not ReticleSize then return end

		if wep:GetStatL("StencilSight_ScaleReticleByScreenHeight", true) then
			ReticleSize = ScreenScaleH(ReticleSize)
		end

		if wep:GetStatL("StencilSight_ScaleReticleByProgress", true) then
			ReticleSize = ReticleSize * wep.IronSightsProgress
		end

		local w, h = ScrW(), ScrH()

		local x, y = w * .5, h * .5
		if wep:GetStatL("StencilSight_FollowRecoil", true) then
			x, y = TFA.LastCrosshairPosX or x, TFA.LastCrosshairPosY or y
		end

		local TargetColor = wep:GetStatL("StencilSight_ReticleTint", color_white)

		if wep:GetStatL("StencilSight_ReticleTintBySightColor", false) and IsValid(wep:GetOwner()) then
			local Owner = wep:GetOwner()

			local _GetNWVector = Owner.GetNW2Vector or Owner.GetNWVector

			local ColorVec = _GetNWVector(Owner, "TFAReticuleColor")

			if ColorVec then
				TargetColor = Color(ColorVec.x, ColorVec.y, ColorVec.z)
			end
		end

		if wep:GetStatL("StencilSight_FadeReticleByProgress", false) then
			TargetColor = ColorAlpha(TargetColor, wep.IronSightsProgress * 255)
		end

		cam.Start2D()
			surface.SetMaterial(ReticleMaterial)
			surface.SetDrawColor(TargetColor)
			surface.DrawTexturedRect(x - ReticleSize * .5, y - ReticleSize * .5, ReticleSize, ReticleSize)
		cam.End2D()
	end
end

do -- Model reticle, for when you don't have an attach point
	if IsValid(TFA.SightReticleEnt) then
		TFA.SightReticleEnt:Remove()
		TFA.SightReticleEnt = nil
	end

	TFA.SightReticleEnt = ClientsideModel("models/error.mdl", RENDERGROUP_VIEWMODEL)
	TFA.SightReticleEnt:SetNoDraw(true)

	local SightReticleEnt = TFA.SightReticleEnt

	DrawFunctions[TFA.Enum.RETICLE_MODEL] = function(vm, ply, wep, SightElementTable)
		if not SightElementTable.reticle then return end

		local SightElementModel = SightElementTable.curmodel

		SightReticleEnt:SetModel(SightElementTable.reticle)
		if SightReticleEnt:GetModel() == "models/error.mdl" then return end

		local matrix = Matrix()
		matrix:Scale(SightElementTable.size)
		SightReticleEnt:EnableMatrix("RenderMultiply", matrix)

		if SightReticleEnt:GetParent() ~= SightElementModel then
			SightReticleEnt:SetParent(SightElementModel)
			SightReticleEnt:SetPos(SightElementModel:GetPos())
			SightReticleEnt:SetAngles(SightElementModel:GetAngles())

			if not SightReticleEnt:IsEffectActive(EF_BONEMERGE) then
				SightReticleEnt:AddEffects(EF_BONEMERGE)
				SightReticleEnt:AddEffects(EF_BONEMERGE_FASTCULL)
			end
		end

		if wep.ViewModelFlip then render.CullMode(MATERIAL_CULLMODE_CW) end
		if wep:GetStatL("StencilSight_FadeReticleByProgress", false) then
			local oldBlend = render.GetBlend()

			render.SetBlend(wep.IronSightsProgress)
			SightReticleEnt:DrawModel()
			render.SetBlend(oldBlend)
		else
			SightReticleEnt:DrawModel()
		end
		if wep.ViewModelFlip then render.CullMode(MATERIAL_CULLMODE_CCW) end

		if wep:GetStatL("StencilSight_EnableQuad") and bit.band(wep:GetStatL("StencilSight_ReticleType")) ~= TFA.Enum.RETICLE_QUAD then
			DrawFunctions[TFA.Enum.RETICLE_QUAD](vm, ply, wep, SightElementTable)
		end
	end
end

do -- Quad/Attach reticle, TFA INS2 method
	local function GetTargetPosition(wep, SightElementTable)
		local TargetEntity = SightElementTable.curmodel
		if not IsValid(TargetEntity) then return end

		local Type = wep:GetStatL("StencilSight_PositionType", TFA.Enum.SIGHTSPOS_ATTACH)

		local pos, ang

		if Type == TFA.Enum.SIGHTSPOS_ATTACH then
			local AttachmentID = wep:GetStatL("StencilSight_ReticleAttachment")
			if not AttachmentID then return end

			if type(AttachmentID) == "string" then
				AttachmentID = TargetEntity:LookupAttachment(AttachmentID)
			end

			if not AttachmentID or AttachmentID <= 0 then return end

			local Attachment = TargetEntity:GetAttachment(AttachmentID)
			if not Attachment.Pos or not Attachment.Ang then return end

			pos, ang = Attachment.Pos, Attachment.Ang
		elseif Type == TFA.Enum.SIGHTSPOS_BONE then
			local BoneID = wep:GetStatL("StencilSight_ReticleBone")

			if type(BoneID) == "string" then
				BoneID = TargetEntity:LookupBone(BoneID)
			end

			if not BoneID or BoneID < 0 then return end

			pos, ang = TargetEntity:GetBonePosition(BoneID)

			if pos == TargetEntity:GetPos() then
				pos = TargetEntity:GetBoneMatrix(BoneID):GetTranslation()
				ang = TargetEntity:GetBoneMatrix(BoneID):GetAngles()
			end
		else
			return
		end

		local OffsetPos = wep:GetStatL("StencilSight_ReticleOffsetPos")
		if OffsetPos then
			pos = pos + ang:Right() * OffsetPos.x + ang:Forward() * OffsetPos.y + ang:Up() * OffsetPos.z
		end

		local OffsetAng = wep:GetStatL("StencilSight_ReticleOffsetAng")
		if OffsetAng then
			ang:RotateAroundAxis(ang:Right(), OffsetAng.p)
			ang:RotateAroundAxis(ang:Up(), OffsetAng.y)
			ang:RotateAroundAxis(ang:Forward(), OffsetAng.r)
		end

		return pos, ang
	end

	DrawFunctions[TFA.Enum.RETICLE_QUAD] = function(vm, ply, wep, SightElementTable)
		local ReticleMaterial = wep:GetStatL("StencilSight_ReticleMaterial")
		if not ReticleMaterial then return end

		if type(ReticleMaterial) == "string" then
			CachedMaterials[ReticleMaterial] = CachedMaterials[ReticleMaterial] or Material(ReticleMaterial, "noclamp nocull smooth")
			ReticleMaterial = CachedMaterials[ReticleMaterial]
		end

		local ReticleSize = wep:GetStatL("StencilSight_ReticleSize")
		if not ReticleSize then return end

		if wep:GetStatL("StencilSight_ScaleReticleByProgress", false) then
			ReticleSize = ReticleSize * wep.IronSightsProgress
		end

		local TargetColor = wep:GetStatL("StencilSight_ReticleTint", color_white)

		if wep:GetStatL("StencilSight_ReticleTintBySightColor", false) and IsValid(wep:GetOwner()) then
			local Owner = wep:GetOwner()

			local _GetNWVector = Owner.GetNW2Vector or Owner.GetNWVector

			local ColorVec = _GetNWVector(Owner, "TFAReticuleColor")

			if ColorVec then
				TargetColor = Color(ColorVec.x, ColorVec.y, ColorVec.z)
			end
		end

		if wep:GetStatL("StencilSight_FadeReticleByProgress", false) then
			TargetColor = ColorAlpha(TargetColor, wep.IronSightsProgress * 255)
		end

		local p, a = GetTargetPosition(wep, SightElementTable)
		if not p or not a then return end

		render.SetMaterial(ReticleMaterial)
		render.DrawQuadEasy(p, a:Forward() * -1, ReticleSize, ReticleSize, TargetColor, 180 + a.r * (wep.ViewModelFlip and 1 or -1))
	end
end

-- hook logic
if IsValid(TFA.SightMaskEnt) then
	TFA.SightMaskEnt:Remove()
	TFA.SightMaskEnt = nil
end

TFA.SightMaskEnt = ClientsideModel("models/error.mdl", RENDERGROUP_OTHER)
TFA.SightMaskEnt:SetNoDraw(true)
local SightMaskEnt = TFA.SightMaskEnt

local ShouldSkipVMDraw = TFA.ShouldSkipVMDraw
local halo_RenderedEntity = halo.RenderedEntity

local function DrawSight(vm, ply, wep, flags)
	if ShouldSkipVMDraw(vm, wep, flags) then return end

	local shouldDraw = hook.Run("TFA_ShouldDrawStencilSight", wep, vm, flags)
	if shouldDraw == false then return end

	local wep2 = wep:GetTable()

	if wep2.TFA_IsDrawingStencilSights then return end
	wep2.TFA_IsDrawingStencilSights = true

	if not wep2.GetStatL(wep, "StencilSight") then wep2.TFA_IsDrawingStencilSights = false return end
	if wep2.IronSightsProgress < wep2.GetStatL(wep, "StencilSight_MinPercent", 0.05) then wep2.TFA_IsDrawingStencilSights = false return end

	local SightElementName = wep2.GetStatL(wep, "StencilSight_VElement")
	if not SightElementName or not wep2.GetStatL(wep, "ViewModelElements." .. SightElementName .. ".active") then wep2.TFA_IsDrawingStencilSights = false return end

	local SightElementTable = wep2.GetStatL(wep, "ViewModelElements." .. SightElementName)
	if not SightElementTable then wep2.TFA_IsDrawingStencilSights = false return end

	local SightElementModel = SightElementTable.curmodel
	if not IsValid(SightElementModel) or halo_RenderedEntity() == SightElementModel then wep2.TFA_IsDrawingStencilSights = false return end

	if useStencils then
		defineCanvas()

		local SightMaskModel = SightElementModel

		if wep2.GetStatL(wep, "StencilSight_UseMask", false) and SightElementTable.mask then
			SightMaskEnt:SetModel(SightElementTable.mask)

			if SightMaskEnt:GetModel() ~= "models/error.mdl" then
				SightMaskModel = SightMaskEnt

				local matrix = Matrix()
				matrix:Scale(SightElementTable.size)
				SightMaskEnt:EnableMatrix("RenderMultiply", matrix)

				if SightMaskEnt:GetParent() ~= SightElementModel then
					SightMaskEnt:SetParent(SightElementModel)
					SightMaskEnt:SetPos(SightElementModel:GetPos())
					SightMaskEnt:SetAngles(SightElementModel:GetAngles())

					if not SightMaskEnt:IsEffectActive(EF_BONEMERGE) then
						SightMaskEnt:AddEffects(EF_BONEMERGE)
						SightMaskEnt:AddEffects(EF_BONEMERGE_FASTCULL)
					end
				end
			end
		end

		if wep2.ViewModelFlip then render.CullMode(MATERIAL_CULLMODE_CW) end
		local oldBlend = render.GetBlend()
		render.SetBlend(0)
			SightMaskModel:DrawModel(flags)
		render.SetBlend(oldBlend)
		if wep2.ViewModelFlip then render.CullMode(MATERIAL_CULLMODE_CCW) end

		drawOn()
	end

	local retValPre = wep2.CallAttFunc(wep, "PreDrawStencilSight", vm, ply, SightElementTable, flags)
	if retValPre ~= true then
		retValPre = wep2.PreDrawStencilSight(wep, vm, ply, SightElementTable, flags) or retValPre
	end

	if retValPre ~= false then
		local funcType = wep2.GetStatL(wep, "StencilSight_ReticleType", TFA.Enum.RETICLE_FLAT)

		for _, retType in ipairs(TFA.Enum.RETICLE_DRAW_ORDER) do
			if bit.band(funcType, retType) == retType and DrawFunctions[retType] then
				ProtectedCall(function()
					DrawFunctions[retType](vm, ply, wep, SightElementTable, flags)
				end)
			end
		end

		local retValPost = wep2.CallAttFunc(wep, "PostDrawStencilSight", vm, ply, SightElementTable, flags)
		if retValPost ~= true then
			wep2.PostDrawStencilSight(wep, vm, ply, SightElementTable, flags)
		end
	end

	if useStencils then
		stopCanvas()
	end

	wep2.TFA_IsDrawingStencilSights = false
end

hook.Add("PostDrawViewModel", "TFA_DrawStencilSight", function(vm, ply, wep, flags)
	if not IsValid(wep) or not wep.IsTFAWeapon or wep.UseHands then return end

	DrawSight(vm, ply, wep, flags)
end)
hook.Add("PostDrawPlayerHands", "TFA_DrawStencilSight", function(hands, vm, ply, wep, flags)
	if not IsValid(wep) or not wep.IsTFAWeapon or not wep.UseHands then return end

	DrawSight(vm, ply, wep, flags)
end)