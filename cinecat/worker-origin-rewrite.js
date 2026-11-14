(() => {
	if (window.__cinecatZcdnRewriteInstalled) return;
	window.__cinecatZcdnRewriteInstalled = true;

	const SERVICES = {
		zcdn: 'VITE_ZCDN_URL',
		'zstream-proxy': 'VITE_PROXY_URL',
		zmusic: 'VITE_MUSIC_API_URL',
		'skip-intro': 'VITE_ACR_API_URL',
		websearch: 'VITE_DISCOVER_API_URL',
		zrelease: 'VITE_RELEASE_API_URL',
		zchapters: 'VITE_CHAPTERS_API_URL',
		'zchapters-pipeline': 'VITE_CHAPTERS_PIPELINE_URL',
		zparty: 'VITE_PARTY_API_URL',
		'elevenlabs-proxy': 'VITE_ELEVENLABS_URL'
	};
	const RETIRED = /^([a-z0-9-]+)\.(?:bluevelvet\.space|funnylookingdoors\.online|spiderswithwebswithhallowness\.online|iamwatchingyou\.site|thepoliterefrigeratorsleepsnexttothedoor\.online|[a-z0-9-]+\.workers\.dev)$/i;
	const FALLBACK_ZCDN = 'https://zcdn1.2wwlgkfo-31a.workers.dev';

	function redirect(rawUrl) {
		let url;
		try {
			url = new URL(rawUrl, location.href);
		} catch {
			return null;
		}
		const custom = /^([a-z0-9-]+)\.spiderswithwebswithhallowness\.online$/i.exec(url.hostname);
		if (custom) {
			url.hostname = custom[1].toLowerCase() + '.2wwlgkfo-31a.workers.dev';
			url.protocol = 'https:';
			return url.toString();
		}
		const match = RETIRED.exec(url.hostname);
		const key = match && SERVICES[match[1].toLowerCase()];
		if (!key) return null;
		let target = window.__CONFIG__?.[key];
		if (!target && key === 'VITE_ZCDN_URL') target = FALLBACK_ZCDN;
		if (!target) return null;
		let configuredOrigin;
		try {
			configuredOrigin = new URL(target);
		} catch {
			return null;
		}
		if (configuredOrigin.host === url.host) return null;
		url.protocol = configuredOrigin.protocol;
		url.host = configuredOrigin.host;
		return url.toString();
	}

	const RB = new Map();
	try {
		for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem('zcdn-rb') || '{}'))) RB.set(k, v);
	} catch {}
	const playToken = (u) => /\/play\/([^/]+)\//.exec(u.pathname)?.[1];
	function learn(text) {
		try {
			const d = JSON.parse(text);
			if (!d || !d.rb || !d.url) return;
			const token = playToken(new URL(d.url, location.href));
			if (!token) return;
			RB.set(token, d.rb);
			try {
				sessionStorage.setItem('zcdn-rb', JSON.stringify(Object.fromEntries([...RB].slice(-20))));
			} catch {}
		} catch {}
	}
	function withRb(raw) {
		try {
			const u = new URL(raw, location.href);
			const token = RB.size ? playToken(u) : undefined;
			const rb = token && RB.get(token);
			if (!rb || u.searchParams.has('_rb')) return raw;
			u.searchParams.set('_rb', rb);
			return u.toString();
		} catch {
			return raw;
		}
	}
	const isCdn = (raw) => {
		try {
			return new URL(raw, location.href).pathname === '/cdn';
		} catch {
			return false;
		}
	};

	const TMDB_HOST = /^(?:api\.themoviedb\.org|api\.tmdb\.org)$/i;
	let tmdbWorkerDownUntil = 0;
	function tmdbRestOf(raw) {
		try {
			const u = new URL(raw, location.href);
			if (!TMDB_HOST.test(u.hostname) || !u.pathname.startsWith('/3/')) return null;
			u.searchParams.delete('api_key');
			return u.pathname + u.search;
		} catch {
			return null;
		}
	}
	function tmdbBases() {
		const worker = window.__CONFIG__?.TMDB_PROXY_URL;
		const site = location.origin + '/m';
		return worker && Date.now() >= tmdbWorkerDownUntil ? [String(worker).replace(/\/+$/, ''), site] : [site];
	}
	function tmdbFetch(self, rest, input, init) {
		const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
		headers.delete('authorization');
		const signal = (init && init.signal) || (input instanceof Request ? input.signal : undefined);
		const bases = tmdbBases();
		const site = location.origin + '/m';
		const attempt = async (i) => {
			const base = bases[i];
			const last = i === bases.length - 1;
			const ctl = new AbortController();
			const timer = setTimeout(() => ctl.abort(), last ? 15000 : 4000);
			if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
			try {
				const res = await nativeFetch.call(self, base + rest, { method: 'GET', headers, credentials: 'omit', signal: ctl.signal });
				if (!last && (res.status >= 500 || res.status === 429 || res.status === 403)) throw new Error('gateway ' + res.status);
				return res;
			} catch (error) {
				if (signal && signal.aborted) throw error;
				if (!last) {
					if (base !== site) tmdbWorkerDownUntil = Date.now() + 120000;   // skip the Worker for two minutes, go straight to the site
					return attempt(i + 1);
				}
				throw error;
			} finally {
				clearTimeout(timer);
			}
		};
		return attempt(0);
	}
	function tmdbOpen(xhr, rest, extra) {
		xhr.__tmdb = true;
		const base = tmdbBases()[0];
		xhr.addEventListener('error', () => {
			if (base !== location.origin + '/m') tmdbWorkerDownUntil = Date.now() + 120000;
		});
		return nativeOpen.call(xhr, 'GET', base + rest, ...extra);
	}

	const nativeFetch = window.fetch;
	window.fetch = function (input, init) {
		const rawUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
		const tmdbRest = tmdbRestOf(rawUrl);
		if (tmdbRest) return tmdbFetch(this, tmdbRest, input, init);
		const final = withRb(redirect(rawUrl) || rawUrl);
		const result = final === rawUrl
			? nativeFetch.call(this, input, init)
			: nativeFetch.call(this, input instanceof Request ? new Request(final, input) : final, init);
		if (isCdn(final)) result.then((r) => r.clone().text().then(learn).catch(() => {}), () => {});
		return result;
	};

	const nativeOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		const raw = url instanceof URL ? url.href : String(url);
		const tmdbRest = tmdbRestOf(raw);
		if (tmdbRest) return tmdbOpen(this, tmdbRest, rest);
		const final = withRb(redirect(raw) || raw);
		if (isCdn(final)) {
			this.addEventListener('load', () => {
				try {
					learn(typeof this.response === 'object' && this.response ? JSON.stringify(this.response) : this.responseText);
				} catch {}
			});
		}
		return nativeOpen.call(this, method, final === raw ? url : final, ...rest);
	};

	const nativeSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
	XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
		if (this.__tmdb && /^authorization$/i.test(name)) return;      // the baked-in read token must not be sent anywhere
		return nativeSetRequestHeader.call(this, name, value);
	};
})();
