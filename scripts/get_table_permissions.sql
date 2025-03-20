-- Function to get table permissions
CREATE OR REPLACE FUNCTION get_table_permissions(table_name TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'table_name', table_name,
        'has_rls', obj.reloptions::text[] @> ARRAY['security_barrier=true'],
        'policies', jsonb_agg(
            jsonb_build_object(
                'policy_name', pol.polname,
                'roles', pol.polroles,
                'cmd', pol.polcmd,
                'qual', pg_get_expr(pol.polqual, pol.polrelid, true),
                'with_check', pg_get_expr(pol.polwithcheck, pol.polrelid, true)
            )
        )
    )
    INTO result
    FROM pg_class obj
    LEFT JOIN pg_policy pol ON pol.polrelid = obj.oid
    WHERE obj.relname = table_name
    GROUP BY obj.relname, obj.reloptions;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_table_permissions TO authenticated;

-- Comment on function
COMMENT ON FUNCTION get_table_permissions IS 'Returns permissions and RLS policies for a given table';

