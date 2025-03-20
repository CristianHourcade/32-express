-- Función para obtener las columnas de una tabla
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable boolean
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    column_name::text,
    data_type::text,
    (is_nullable = 'YES')::boolean as is_nullable
  FROM
    information_schema.columns
  WHERE
    table_name = p_table_name
    AND table_schema = 'public';
$$;

-- Asegúrate de que la función sea accesible para todos los usuarios
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;

