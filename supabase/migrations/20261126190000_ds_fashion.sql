-- =====================================================
-- CONTROLE DS FASHION
-- MIGRAÇÃO INICIAL DO BANCO DE DADOS
-- Supabase PostgreSQL
-- =====================================================

-- 1. TABELA PRINCIPAL DE DADOS
-- Cada usuário terá seus próprios dados.

CREATE TABLE IF NOT EXISTS public.ds_fashion_dados (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id)
        ON DELETE CASCADE,

    dados JSONB NOT NULL DEFAULT
        '{"clientes":[],"produtos":[],"vendas":[]}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ds_fashion_dados_objeto
        CHECK (jsonb_typeof(dados) = 'object')
);

-- 2. ATIVAR SEGURANÇA RLS

ALTER TABLE public.ds_fashion_dados
ENABLE ROW LEVEL SECURITY;

-- 3. REMOVER POLÍTICAS ANTERIORES
-- Evita conflito ao executar novamente.

DROP POLICY IF EXISTS "ds_fashion_select"
ON public.ds_fashion_dados;

DROP POLICY IF EXISTS "ds_fashion_insert"
ON public.ds_fashion_dados;

DROP POLICY IF EXISTS "ds_fashion_update"
ON public.ds_fashion_dados;

DROP POLICY IF EXISTS "ds_fashion_delete"
ON public.ds_fashion_dados;

-- 4. POLÍTICA DE LEITURA

CREATE POLICY "ds_fashion_select"
ON public.ds_fashion_dados
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);

-- 5. POLÍTICA DE INSERÇÃO

CREATE POLICY "ds_fashion_insert"
ON public.ds_fashion_dados
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- 6. POLÍTICA DE ATUALIZAÇÃO

CREATE POLICY "ds_fashion_update"
ON public.ds_fashion_dados
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- 7. POLÍTICA DE EXCLUSÃO

CREATE POLICY "ds_fashion_delete"
ON public.ds_fashion_dados
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
);

-- 8. PERMISSÕES DOS USUÁRIOS AUTENTICADOS

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.ds_fashion_dados
TO authenticated;

-- 9. FUNÇÃO PARA ATUALIZAR A DATA DE MODIFICAÇÃO

CREATE OR REPLACE FUNCTION
public.ds_fashion_atualizar_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 10. GATILHO DE ATUALIZAÇÃO

DROP TRIGGER IF EXISTS
ds_fashion_updated_at
ON public.ds_fashion_dados;

CREATE TRIGGER ds_fashion_updated_at
BEFORE UPDATE ON public.ds_fashion_dados
FOR EACH ROW
EXECUTE FUNCTION
public.ds_fashion_atualizar_data();

-- =====================================================
-- FIM DA MIGRAÇÃO INICIAL DS FASHION
-- =====================================================
