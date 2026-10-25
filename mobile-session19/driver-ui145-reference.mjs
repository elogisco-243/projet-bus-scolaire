/** UI-160: SVG excerpts faithfully transcribed from the APK supplied by the user.
 * Source: A2S-Scola_UI-145_20261021-232542-371_debug.apk
 * SHA256 e34e8cc404c91cca3058a5c01394f5961f22603864716f851139413e5d5d27fe
 * assets/public/ui-components.mjs (Lucide paths) and ui.mjs (driver bottom bus).
 * No imported APK code is executed; this is a DEMO-only presentation resource.
 */
export const DRIVER_APK_ICONS=Object.freeze({
 'nav-bus':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M7 7V4h10v3"/><circle cx="7.5" cy="20" r="1"/><circle cx="16.5" cy="20" r="1"/><path d="M3 14h18"/>',
 bus:'<path d="M8 6v6m8-6v6M5 17h14M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v12H5V6Z"/><path d="M7 21v-3m10 3v-3"/>',
 alert:'<path d="m10.3 3.9-8.2 14.2A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
 team:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 speaker:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
 refresh:'<path d="M21 11a9 9 0 1 1-2.7-6.4"/><path d="M21 3v6h-6"/>',
 flag:'<path d="M5 21V4"/><path d="M5 5c3-2 5 2 9 0s5-1 5-1v11c-3-1-5-1-8 0s-4-2-6 0"/>',
 wifi:'<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
 'wifi-off':'<path d="M12 20h.01"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="m2 2 20 20"/>',
 shield:'<path d="M12 3 19 6v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
});
export const DRIVER_UI145_SPEC=Object.freeze({
 apkSha256:'e34e8cc404c91cca3058a5c01394f5961f22603864716f851139413e5d5d27fe',
 versionName:'1.7',ui:'UI-145',
 tabs:Object.freeze(['Ma tournée','Alertes','Équipe','Plus']),
 buttons:Object.freeze(['DÉMARRER LA COURSE','NOUVELLE TOURNÉE','ARRÊT ATTEINT','CLÔTURER LA COURSE']),
 route:Object.freeze(['Dépôt','Golf','Centre','École Horizon']),
 pupils:Object.freeze(['A-01','A-02','A-03','A-04']),
 visual:Object.freeze({navIconPx:25,actionIconPx:26,shortPhoneActionIconPx:23,stopColor:'#ffe48a',stopFont:'clamp(16px,4vw,20px)'})
});
