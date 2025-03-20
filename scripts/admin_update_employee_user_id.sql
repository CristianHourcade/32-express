-- Function to update employee user_id with admin privileges
CREATE OR REPLACE FUNCTION admin_update_employee_user_id(employee_id UUID, user_id_value UUID)
RETURNS VOID AS $$
BEGIN
  -- Update the employee record with the user_id
  UPDATE employees
  SET user_id = user_id_value
  WHERE id = employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_employee_user_id TO authenticated;

-- Comment on function
COMMENT ON FUNCTION admin_update_employee_user_id IS 'Updates an employee record with a user_id with elevated privileges';

