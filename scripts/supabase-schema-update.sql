-- Primero, verificamos si las tablas existen y las creamos si no
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  total NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear función para crear una venta con sus items (reemplazar si ya existe)
CREATE OR REPLACE FUNCTION create_sale(
  p_business_id UUID,
  p_employee_id UUID,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_shift_id UUID,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_price NUMERIC;
  v_current_stock INTEGER;
BEGIN
  -- Crear la venta
  INSERT INTO sales (business_id, employee_id, shift_id, total, payment_method)
  VALUES (p_business_id, p_employee_id, p_shift_id, p_total, p_payment_method)
  RETURNING id INTO v_sale_id;
  
  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC;
    
    -- Verificar stock
    SELECT stock INTO v_current_stock FROM products WHERE id = v_product_id;
    
    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', v_product_id;
    END IF;
    
    -- Crear el item de venta
    INSERT INTO sale_items (sale_id, product_id, quantity, price)
    VALUES (v_sale_id, v_product_id, v_quantity, v_price);
    
    -- Actualizar stock
    UPDATE products SET stock = stock - v_quantity WHERE id = v_product_id;
  END LOOP;
  
  RETURN jsonb_build_object('sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS en todas las tablas
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes antes de crearlas nuevamente
DO $$
BEGIN
    -- Eliminar políticas de la tabla users
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver sus propios datos" ON users;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla businesses
    BEGIN
        DROP POLICY IF EXISTS "Administradores pueden ver sus negocios" ON businesses;
        DROP POLICY IF EXISTS "Administradores pueden modificar sus negocios" ON businesses;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla employees
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver empleados de su negocio" ON employees;
        DROP POLICY IF EXISTS "Administradores pueden modificar empleados de su negocio" ON employees;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla products
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver productos de su negocio" ON products;
        DROP POLICY IF EXISTS "Administradores pueden modificar productos de su negocio" ON products;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla shifts
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver turnos de su negocio" ON shifts;
        DROP POLICY IF EXISTS "Administradores pueden modificar turnos de su negocio" ON shifts;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla sales
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver ventas de su negocio" ON sales;
        DROP POLICY IF EXISTS "Administradores pueden modificar ventas de su negocio" ON sales;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla sale_items
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver items de venta de su negocio" ON sale_items;
        DROP POLICY IF EXISTS "Administradores pueden modificar items de venta de su negocio" ON sale_items;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla expenses
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver gastos de su negocio" ON expenses;
        DROP POLICY IF EXISTS "Administradores pueden modificar gastos de su negocio" ON expenses;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
    
    -- Eliminar políticas de la tabla activities
    BEGIN
        DROP POLICY IF EXISTS "Usuarios pueden ver actividades de su negocio" ON activities;
        DROP POLICY IF EXISTS "Administradores pueden modificar actividades de su negocio" ON activities;
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores
    END;
END $$;

-- Crear nuevas políticas
-- Política para usuarios autenticados
CREATE POLICY "Usuarios pueden ver sus propios datos" ON users
  FOR ALL USING (auth.uid() = auth_id);

-- Política para negocios
CREATE POLICY "Administradores pueden ver sus negocios" ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = businesses.id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Administradores pueden modificar sus negocios" ON businesses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = businesses.id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para empleados
CREATE POLICY "Usuarios pueden ver empleados de su negocio" ON employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = employees.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar empleados de su negocio" ON employees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = employees.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para productos
CREATE POLICY "Usuarios pueden ver productos de su negocio" ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = products.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar productos de su negocio" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = products.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para turnos
CREATE POLICY "Usuarios pueden ver turnos de su negocio" ON shifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = shifts.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar turnos de su negocio" ON shifts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = shifts.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para ventas
CREATE POLICY "Usuarios pueden ver ventas de su negocio" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = sales.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar ventas de su negocio" ON sales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = sales.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para items de venta
CREATE POLICY "Usuarios pueden ver items de venta de su negocio" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales
      JOIN users ON users.business_id = sales.business_id
      WHERE sale_items.sale_id = sales.id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar items de venta de su negocio" ON sale_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sales
      JOIN users ON users.business_id = sales.business_id
      WHERE sale_items.sale_id = sales.id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para gastos
CREATE POLICY "Usuarios pueden ver gastos de su negocio" ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = expenses.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar gastos de su negocio" ON expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = expenses.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Política para actividades
CREATE POLICY "Usuarios pueden ver actividades de su negocio" ON activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = activities.business_id
      AND users.auth_id = auth.uid()
    )
  );

CREATE POLICY "Administradores pueden modificar actividades de su negocio" ON activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.business_id = activities.business_id
      AND users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

