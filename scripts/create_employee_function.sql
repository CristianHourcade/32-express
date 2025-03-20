-- Función para crear un empleado con usuario de autenticación
CREATE OR REPLACE FUNCTION create_employee_with_auth(
  p_name TEXT,
  p_email TEXT,
  p_business_id UUID,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con los privilegios del creador de la función
AS $$
DECLARE
  v_user_id UUID;
  v_employee_id UUID;
  v_result JSONB;
BEGIN
  -- Crear usuario en auth.users directamente (esto requiere permisos especiales)
  -- Nota: En un entorno real, esto debería hacerse a través de una API segura
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    p_email,
    crypt(p_password, gen_salt('bf')), -- Encripta la contraseña
    NOW(),                             -- Email ya confirmado
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', p_name, 'business_id', p_business_id),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Crear el empleado asociado al usuario
  INSERT INTO employees (
    name,
    email,
    business_id,
    user_id,
    created_at,
    updated_at
  ) VALUES (
    p_name,
    p_email,
    p_business_id,
    v_user_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_employee_id;

  -- Construir el resultado
  SELECT jsonb_build_object(
    'id', v_employee_id,
    'name', p_name,
    'email', p_email,
    'business_id', p_business_id,
    'user_id', v_user_id
  ) INTO v_result;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating employee: %', SQLERRM;
END;
$$;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION create_employee_with_auth TO authenticated;
GRANT EXECUTE ON FUNCTION create_employee_with_auth TO anon;
GRANT EXECUTE ON FUNCTION create_employee_with_auth TO service_role;

