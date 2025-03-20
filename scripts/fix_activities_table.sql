-- Verificar si la tabla activities existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'activities'
    ) THEN
        -- Crear la tabla activities si no existe
        CREATE TABLE activities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id),
            business_id UUID NOT NULL REFERENCES businesses(id),
            action TEXT NOT NULL,
            details TEXT,
            user_role TEXT NOT NULL DEFAULT 'employee',
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        -- Verificar si la columna user_role existe
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'activities'
            AND column_name = 'user_role'
        ) THEN
            -- Agregar la columna user_role si no existe
            ALTER TABLE activities ADD COLUMN user_role TEXT NOT NULL DEFAULT 'employee';
        END IF;

        -- Verificar si la columna timestamp existe
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'activities'
            AND column_name = 'timestamp'
        ) THEN
            -- Agregar la columna timestamp si no existe
            ALTER TABLE activities ADD COLUMN timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Actualizar registros existentes si es necesario
UPDATE activities
SET user_role = 'employee'
WHERE user_role IS NULL;

-- Actualizar registros existentes si es necesario
UPDATE activities
SET timestamp = NOW()
WHERE timestamp IS NULL;

