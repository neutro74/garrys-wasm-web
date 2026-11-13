local cv_enable = CreateClientConVar("cl_tfa_subcategories_enabled", "1", true, false, "Enable spawnmenu subcategories? (Update spawnmenu with spawnmenu_reload command after changing this!)")
local cv_autoassign = CreateClientConVar("cl_tfa_subcategories_auto", "0", true, false, "Attempt to auto-assign missing subcategories based on weapon's type?")

local function PopulateWeapons(pnlContent, tree, browseNode)
	if not cv_enable:GetBool() then return end

	local cats, subs = {}, {}

	for class, _wep in pairs(list.Get("Weapon") or {}) do
		if not _wep.Spawnable then continue end

		local cat = language.GetPhrase(_wep.Category ~= "Other" and _wep.Category or "#spawnmenu.category.other")
		cats[cat] = cats[cat] or {}

		if not weapons.IsBasedOn(class, "tfa_gun_base") then
			table.insert(cats[cat], _wep)

			continue
		end

		local wep = weapons.Get(class)
		local sub = wep.SubCategory or (cv_autoassign:GetBool() and wep:GetType())
		if not sub or sub == "" then
			table.insert(cats[cat], wep)

			continue
		end

		subs[cat] = subs[cat] or {}
		subs[cat][sub] = subs[cat][sub] or {}

		table.insert(subs[cat][sub], wep)
	end

	local root = tree:Root()
	if not IsValid(root) then return end

	for _, node in ipairs(root:GetChildNodes()) do
		local name = node:GetText()
		if not name or not subs[name] then continue end

		node.DoPopulate = function(self)
			if self.PropPanel then return end

			self.PropPanel = vgui.Create("ContentContainer", pnlContent)
			self.PropPanel:SetVisible(false)
			self.PropPanel:SetTriggerSpawnlistChange(false)

			for sname, subcat in SortedPairs(subs[name]) do
				spawnmenu.CreateContentIcon("header", self.PropPanel, {text = sname})

				for _, ent in SortedPairsByMemberValue(subcat, "PrintName") do
					spawnmenu.CreateContentIcon(ent.ScriptedEntityType or "weapon", self.PropPanel, {
						nicename	= ent.PrintName or ent.ClassName,
						spawnname	= ent.ClassName,
						material	= ent.IconOverride or "entities/" .. ent.ClassName .. ".png",
						admin		= ent.AdminOnly
					})
				end
			end

			if cats[name] and #cats[name] > 0 then
				spawnmenu.CreateContentIcon("header", self.PropPanel, {text = "Other"})

				for _, ent in SortedPairsByMemberValue(cats[name], "PrintName") do
					spawnmenu.CreateContentIcon(ent.ScriptedEntityType or "weapon", self.PropPanel, {
						nicename	= ent.PrintName or ent.ClassName,
						spawnname	= ent.ClassName,
						material	= ent.IconOverride or "entities/" .. ent.ClassName .. ".png",
						admin		= ent.AdminOnly
					})
				end
			end
		end
	end
end

hook.Add("PopulateWeapons", "AddTFAWeaponContent", function(pnlContent, tree, browseNode)
	timer.Simple(0, function()
		PopulateWeapons(pnlContent, tree, browseNode)
	end)
end, 1)

TFA.BASE_LOAD_COMPLETE = true