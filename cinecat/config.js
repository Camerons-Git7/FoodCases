window.__CONFIG__ = Object.assign(window.__CONFIG__ || {}, {
	WORKER_DOMAIN: '2wwlgkfo-31a.workers.dev',
	VITE_ZCDN_URL: ['zcdn1', 'zcdn2', 'zcdn3'].map((n) => 'https://' + n + '.2wwlgkfo-31a.workers.dev')[Math.floor(Math.random() * 3)],
	VITE_PROXY_URL: ['zstream-proxy1', 'zstream-proxy2', 'zstream-proxy3'].map((n) => 'https://' + n + '.2wwlgkfo-31a.workers.dev')[Math.floor(Math.random() * 3)],
	TMDB_PROXY_URL: 'https://epfopf2vba.2wwlgkfo-31a.workers.dev',
	VITE_ELEVENLABS_URL: 'https://elevenlabs-proxy.2wwlgkfo-31a.workers.dev',
	VITE_ACR_API_URL: 'https://skip-intro.2wwlgkfo-31a.workers.dev',
	VITE_DISCOVER_API_URL: 'https://websearch.2wwlgkfo-31a.workers.dev',
	VITE_RELEASE_API_URL: 'https://zrelease.2wwlgkfo-31a.workers.dev',
	VITE_CHAPTERS_API_URL: 'https://zchapters.2wwlgkfo-31a.workers.dev',
	VITE_CHAPTERS_PIPELINE_URL: 'https://zchapters-pipeline.2wwlgkfo-31a.workers.dev',
	VITE_PARTY_API_URL: 'https://zparty.2wwlgkfo-31a.workers.dev',
	// Empty = no backend provider list is fetched at all; the app runs on its
	// two built-in providers (ZCDN, Aphrodite) only.
	VITE_SOURCES_API_URL: "",
	VITE_CAT_SKINS_URL: "/cats",
	VITE_MUSIC_API_URL: 'https://zmusic.bluevelvet.space'
});
