let PARSEC;

function float_to_int(fval) {
	let ival = fval < 0 ? fval * 32768 : fval * 32767;

	if (ival < -32768) {
		ival = -32768;

	} else if (ival > 32767) {
		ival = 32767;
	}

	return ival;
}

const PARSEC_ENV = {
	// user.bin
	bin_user_bin_get: function (asset_dir_c, session_id_c, size) {
		try {
			const cookies = document.cookie.split(';');

			for (let x = 0; x < cookies.length; x++) {
				const cookie = cookies[x].trim();
				const name = 'parsec_login=';

				if (cookie.indexOf(name) == 0) {
					const auth = JSON.parse(cookie.substring(name.length, cookie.length));
					mty_str_to_c(auth['token'], session_id_c, size);

					return 0;
				}
			}
		} catch (e) {
			console.error(e);
		}

		return -1;
	},
	bin_user_bin_set: function (asset_dir_c, session_id_c) {
		const session_id = mty_str_to_js(session_id_c);

		const value = JSON.stringify({
			'token': session_id,
			'userId': 0,
		});

		const hostname = window.location.hostname.replace(/.*?\./, '');
		const secure = window.location.protocol == 'https:';
		document.cookie = 'parsec_login=' + value + ';domain=' + hostname + ';path=/;' +
			(secure ? 'secure' : '') + ';max-age=31536000;samesite=strict;';
	},
	bin_user_bin_delete: function (asset_dir_c) {
		const hostname = window.location.hostname.replace(/.*?\./, '');
		document.cookie = 'parsec_login=;domain=' + hostname + ';path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;';
	},

	// Parsec protocol
	web_parsec_protocol: function (peer_id) {
		window.location.assign('parsec://peer_id=' + mty_str_to_js(peer_id));
	},

	// parsec SDK
	parsec_web_init: function () {
		if (PARSEC)
			return;

		const container = document.createElement('div');
		container.style.zIndex = -1;
		container.style.background = 'black';
		container.style.position = 'fixed';
		container.style.top = 0;
		container.style.right = 0;
		container.style.bottom = 0;
		container.style.left = 0;
		document.body.appendChild(container);

		const canvas = document.createElement('canvas');
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		container.appendChild(canvas);

		const updateCanvas = (ev) => {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;
		};

		updateCanvas(null);
		window.addEventListener('resize', updateCanvas);

		PARSEC = new Parsec(canvas);
	},
	parsec_web_destroy: function () {
		if (!PARSEC)
			return;

		PARSEC.destroy();
		PARSEC = undefined;
	},
	parsec_web_disconnect: function (e) {
		PARSEC.clientDisconnect(e);
	},
	parsec_web_get_status: function () {
		return PARSEC.clientGetStatus();
	},
	parsec_web_send_user_data: function (id, msg_c) {
		PARSEC.clientSendUserData(id, mty_str_to_js(msg_c));
	},
	parsec_web_get_guests: function (jstr_c, len) {
		mty_str_to_c(JSON.stringify(PARSEC.clientGetGuests()), jstr_c, len);
	},
	parsec_web_poll_events: function (event_str_c, len) {
		const evt = PARSEC.clientPollEvents();

		if (evt) {
			mty_str_to_c(JSON.stringify(evt), event_str_c, len);
			return true;
		}

		return false;
	},
	parsec_web_get_buffer_size: function (key) {
		return PARSEC.getBufferSize(key);
	},
	parsec_web_get_buffer: function (key, ptr) {
		const buffer = PARSEC.getBuffer(key);

		if (buffer)
			mty_memcpy(ptr, buffer);
	},
	parsec_web_send_message: function (msg_c) {
		PARSEC.clientSendMessage(JSON.parse(mty_str_to_js(msg_c)));
	},
	parsec_web_get_metrics: function (frame_w, frame_h, color444, full_range, decode, encode, network) {
		const metrics = PARSEC.clientGetMetrics();

		mty_set_float(decode, metrics['decodeLatency']);
		mty_set_float(encode, metrics['encodeLatency']);
		mty_set_float(network, metrics['networkLatency']);

		mty_set_uint32(frame_w, metrics['frameWidth']);
		mty_set_uint32(frame_h, metrics['frameHeight']);

		mty_set_int8(color444, metrics['444']);
		mty_set_int8(full_range, metrics['fullRange']);
	},
	parsec_web_get_network_failure: function () {
		return PARSEC.clientNetworkFailure();
	},
	parsec_web_get_self: function (owner_ptr, id_ptr) {
		const me = PARSEC.clientGetSelf();

		mty_set_int8(owner_ptr, me['owner']);
		mty_set_uint32(id_ptr, me['id']);
	},
	parsec_web_get_host_mode: function () {
		return PARSEC.clientGetHostMode();
	},
	parsec_web_new_attempt: async function (attempt_id, ufrag_c, pwd_c, fingerprint_c, buf_size, csync, err_c) {
		const creds = await PARSEC.clientNewAttempt(mty_str_to_js(attempt_id));

		if (creds) {
			mty_set_uint32(err_c, 0);
			mty_str_to_c(creds['ice_ufrag'], ufrag_c, buf_size);
			mty_str_to_c(creds['ice_pwd'], pwd_c, buf_size);
			mty_str_to_c(creds['fingerprint'], fingerprint_c, buf_size);

		} else {
			mty_set_uint32(err_c, 1);
		}

		MTY_SignalPtr(csync);
	},
	parsec_web_begin_p2p: function (attempt_id, port, ufrag, pwd, fingerprint) {
		PARSEC.clientBeginP2P(mty_str_to_js(attempt_id), port, mty_str_to_js(ufrag),
			mty_str_to_js(pwd), mty_str_to_js(fingerprint));
	},
	parsec_web_add_candidate: function (attempt_id, ip, port, sync, from_stun) {
		PARSEC.clientAddCandidate(mty_str_to_js(attempt_id), mty_str_to_js(ip), port, sync, from_stun);
	},
	parsec_web_poll_audio: function (cbuf, len) {
		const fbuf = PARSEC.clientPollAudio();

		if (fbuf) {
			const buf = new Int16Array(MTY_MEMORY.buffer, cbuf, len);

			for (let x = 0; x < fbuf.length; x++)
				buf[x] = float_to_int(fbuf[x]);

			return fbuf.length / 2;
		}

		return 0;
	},
	usb_devices_create: function usb_devices_create(cb, opaque, cur_client_usb_id, mode, filtered){

	},
	usb_devices_destroy: function usb_devices_create(ctx){
		
	},
	usb_device_submit: function usb_device_submit(ctx, data){
		
	},
	usb_devices_set_config: function usb_devices_set_config(ctx, mode, device, enabled){
		
	},
	usb_devices_get: function usb_devices_get(ctx, devices){
		
	},
	maintenance_create: function maintenance_create(){
		
	},
	maintenance_destroy: function maintenance_destroy(maintenance_ctx){
		
	},
	maintenance_force_poll: function maintenance_force_poll(ctx){
		
	},
	maintenance_get_state: function maintenance_get_state(ctx, msg){
		
	},
	ParsecHostGetCameraGuest: function ParsecHostGetCameraGuest(ps){
		
	}
};
