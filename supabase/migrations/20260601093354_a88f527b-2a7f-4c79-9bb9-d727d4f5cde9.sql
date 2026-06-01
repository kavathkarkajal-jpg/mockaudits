
-- Bootstrap admin user (idempotent)
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@mockaudit.app';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'admin@mockaudit.app', crypt('Training@123', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      '{}'::jsonb, false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'admin@mockaudit.app', 'email_verified', true),
      'email', v_uid::text, now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, store_code, full_name)
  VALUES (v_uid, 'ADMIN', 'Admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
