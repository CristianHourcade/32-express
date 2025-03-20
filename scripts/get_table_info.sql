-- Función para obtener información sobre una tabla
CREATE OR REPLACE FUNCTION get_table_info(table_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'column_name', column_name,
        'data_type', data_type,
        'is_nullable', is_nullable,
        'column_default', column_default
      )
    )
    FROM information_schema.columns
    WHERE table_name = $1
  );
END;
$$;

-- Función para obtener las claves foráneas de una tabla
CREATE OR REPLACE FUNCTION get_foreign_keys(table_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'constraint_name', tc.constraint_name,
        'column_name', kcu.column_name,
        'foreign_table', ccu.table_name,
        'foreign_column', ccu.column_name
      )
    )
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = $1
  );
END;
$$;

