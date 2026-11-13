// Source's lowest exposed quality settings, applied on first run only. Never modify the Steam install.
const LOW={mat_picmip:2,r_rootlod:2,mat_antialias:0,mat_aaquality:0,mat_forceaniso:1,mat_trilinear:0,
 mat_vsync:0,mat_hdr_level:0,mat_reducefillrate:1,r_shadowrendertotexture:0,r_waterforceexpensive:0,
 r_waterforcereflectentities:0,mat_motion_blur_enabled:0,mat_colorcorrection:0,r_3dsky:0,
 mat_specular:0,mat_bumpmap:0,mat_bloomscale:0,dsp_slow_cpu:1,snd_pitchquality:0,r_shadows:0, r_flashlightdepthtexture:0,
 cl_detaildist:0, cl_detailfade:0, r_drawdetailprops:0};
// Performance cvars the Options menus do not expose, so no saved preference can conflict. They are applied on every
// start (after config.cfg) and cut cosmetic work only: decals, gibs, ejected brass, dynamic lights, face flexes
// and bump/specular detail, expensive water, ragdoll count. Kept on because play needs them: particles, ropes, sprites,
// eyes, world lighting on models, textures at picmip 2, the flashlight (projected, no shadow map) and the HUD.
const ALWAYS={r_decals:0,mp_decals:0,r_maxmodeldecal:0,r_drawmodeldecals:0,r_dynamic:0,muzzleflash_light:0,cl_ejectbrass:0,
 cl_new_impact_effects:0,r_drawflecks:0,r_ropetranslucent:0,g_ragdoll_maxcount:4,
 mat_fastnobump:1,mat_fastspecular:1,r_flex:0,r_teeth:0,r_shadowmaxrendered:0,r_cheapwaterstart:0,r_cheapwaterend:0,
 r_staticprop_lod:2,r_ambientboost:0,cl_detail_max_sway:0};
// r_flashlightdepthres is pinned to 512 on the browser host: a desktop config (or one saved from it) with 8192 costs
// eight 128 MB shadow maps, about 3 GB of GPU memory in the browser.
// ?res=640x360 overrides the resolution (also over a saved one), so a slow GPU can be tested or tuned without the menus.
// win: the browser window size, used on first run (no saved resolution) so menus are not stretched. scale: the launcher's
// graphics preset, a 3D-only render scale; menus, console and HUD always draw at the full engine resolution.
export function launchOptions({saved=false,cmdline='',res='',win='',scale=''}={}){
 const dims=v=>{const x=/^(\d{3,4})x(\d{3,4})$/.exec(v);return x&&+x[1]>=640&&+x[2]>=360?[+x[1],+x[2]]:null;};
 const m=dims(res),size=m??dims(win)??[960,540],s=+scale>0?Math.min(1,Math.max(0.25,+scale)):0;
 // An explicit fps_max launch command keeps the engine limiter authoritative.
 const targetFps=/\+fps_max\s+/i.test(cmdline)?0:30;
 return {size,targetFps,command:`"c:\\gamebox\\gmod.exe" -game garrysmod -windowed ${m||!saved?`-w ${size[0]} -h ${size[1]} `:''}-nojoy -novid -wavonly +con_enable 1 ${s?`+mat_viewportscale ${s} +mat_viewportupscale 1 `:''}+mat_queue_mode 0 +fps_max 0 +r_flashlightdepthres 512 ${Object.entries(ALWAYS).map(([k,v])=>`+${k} ${v}`).join(' ')} ${saved?'':Object.entries(LOW).map(([k,v])=>`+${k} ${v}`).join(' ')} ${cmdline}`.trim()};
}
