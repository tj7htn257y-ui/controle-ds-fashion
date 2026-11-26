
-- =====================================================
-- DS FASHION
-- MIGRACAO INICIAL DO BANCO SUPABASE
-- =====================================================

BEGIN;

-- 1. TABELA PRINCIPAL DE SINCRONIZACAO
-- Cada usuario tera seu proprio registro criptografado.

CREATE TABLE IF NOT EXISTS public.ds_fashion_cloud (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    password_metadata JSONB NOT NULL,

    encrypted_data TEXT NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDICE DE ATUALIZACAO

CREATE INDEX IF NOT EXISTS
    idx_ds_fashion_cloud_updated_at
ON public.ds_fashion_cloud (updated_at);

-- 3. ATIVAR SEGURANCA RLS

ALTER TABLE public.ds_fashion_cloud
ENABLE ROW LEVEL SECURITY;

-- 4. REMOVER POLITICAS ANTERIORES
-- Permite executar novamente esta parte sem duplicar politicas.

DROP POLICY IF EXISTS
    "DS Fashion - usuario consulta seus dados"
ON public.ds_fashion_cloud;

DROP POLICY IF EXISTS
    "DS Fashion - usuario insere seus dados"
ON public.ds_fashion_cloud;

DROP POLICY IF EXISTS
    "DS Fashion - usuario atualiza seus dados"
ON public.ds_fashion_cloud;

-- 5. POLITICA DE CONSULTA

CREATE POLICY
    "DS Fashion - usuario consulta seus dados"
ON public.ds_fashion_cloud
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);

-- 6. POLITICA DE INSERCAO

CREATE POLICY
    "DS Fashion - usuario insere seus dados"
ON public.ds_fashion_cloud
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- 7. POLITICA DE ATUALIZACAO

CREATE POLICY
    "DS Fashion - usuario atualiza seus dados"
ON public.ds_fashion_cloud
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- 8. PERMISSOES DE ACESSO

REVOKE ALL ON TABLE public.ds_fashion_cloud
FROM PUBLIC;

REVOKE ALL ON TABLE public.ds_fashion_cloud
FROM anon;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.ds_fashion_cloud
TO authenticated;

-- 9. DOCUMENTACAO

COMMENT ON TABLE public.ds_fashion_cloud IS
'DS Fashion: armazenamento criptografado e sincronizado por usuario.';

COMMENT ON COLUMN public.ds_fashion_cloud.user_id IS
'Identificador do usuario autenticado no Supabase.';

COMMENT ON COLUMN public.ds_fashion_cloud.password_metadata IS
'Metadados de criptografia do aplicativo DS Fashion.';

COMMENT ON COLUMN public.ds_fashion_cloud.encrypted_data IS
'Conteudo criptografado contendo clientes, produtos, vendas e pagamentos.';

COMMENT ON COLUMN public.ds_fashion_cloud.updated_at IS
'Data e hora da ultima sincronizacao.';

COMMIT;

-- =====================================================
-- FIM DA MIGRACAO DS FASHION
-- =====================================================
