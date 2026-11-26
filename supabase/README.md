
# Supabase - Controle DS Fashion

Esta pasta contém os arquivos necessários para a integração do aplicativo Controle DS Fashion com o Supabase.

## Estrutura

- `migrations/`: arquivos SQL para criação e atualização do banco de dados.
- `config.toml`: configurações locais do projeto Supabase.
- `README.md`: documentação da integração.

## Banco de dados

O aplicativo utiliza o Supabase para armazenar e sincronizar os dados das lojas:

- Roupas
- Joias
- Clientes
- Produtos
- Vendas
- Pagamentos

## Segurança

O banco de dados utiliza autenticação de usuários e Row Level Security (RLS).

Cada usuário deve ter acesso somente aos seus próprios registros.

As políticas de segurança utilizam:

`auth.uid() = user_id`

## Integração

- Repositório: controle-ds-fashion
- Branch principal: main
- Plataforma de banco de dados: Supabase

## Observação

Os arquivos desta pasta são destinados à configuração, manutenção e evolução da integração entre GitHub e Supabase.

Não armazenar chaves secretas ou senhas neste repositório.
