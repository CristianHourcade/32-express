-- Función para obtener información sobre las claves foráneas de una tabla
CREATE OR REPLACE FUNCTION get_foreign_keys(p_table_name text)
RETURNS TABLE (
  constraint_name text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = p_table_name;
$$;

-- Asegúrate de que la función sea accesible para todos los usuarios
GRANT EXECUTE ON FUNCTION get_foreign_keys(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_foreign_keys(text) TO anon;
GRANT EXECUTE ON FUNCTION get_foreign_keys(text) TO service_role;

