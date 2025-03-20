-- Verificar si la columna user_role existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'activities'
        AND column_name = 'user_role'
    ) THEN
        -- Agregar la columna user_role si no existe
        ALTER TABLE activities ADD COLUMN user_role TEXT;
    END IF;
END $$;

-- Actualizar la columna user_role para registros existentes
UPDATE activities
SET user_role = 'employee'
WHERE user_role IS NULL;

-- Agregar restricción NOT NULL si es necesario
ALTER TABLE activities ALTER COLUMN user_role SET NOT NULL;

-- Verificar si la columna timestamp existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'activities'
        AND column_name = 'timestamp'
    ) THEN
        -- Agregar la columna timestamp si no existe
        ALTER TABLE activities ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Actualizar la columna timestamp para registros existentes
UPDATE activities
SET timestamp = created_at
WHERE timestamp IS NULL AND created_at IS NOT NULL;

-- Agregar restricción NOT NULL si es necesario
ALTER TABLE activities ALTER COLUMN timestamp SET NOT NULL;

