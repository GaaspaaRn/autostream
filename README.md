# AutoStream CRM

Sistema CRM completo para revenda de veículos premium, composto por site público (catálogo), dashboard administrativo, API backend e banco de dados.

## 🏗️ Arquitetura do Sistema

```
AUTOSTREAM/
├── apps/
│   ├── web/              # Site Público (React + Vite)
│   ├── dashboard/        # Dashboard CRM (React + Vite)
│   └── api/              # API Backend (Node.js + Express)
├── packages/
│   └── database/         # Prisma ORM + Schema
└── README.md
```

## 🚀 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend Site | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Frontend CRM | React 18, TypeScript, Tailwind CSS, Recharts |
| Backend | Node.js, Express, TypeScript |
| Banco de Dados | PostgreSQL, Prisma ORM |
| Autenticação | JWT (Access + Refresh Tokens) |

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

## 🛠️ Instalação

### 1. Clone o repositório

```bash
cd autostream
```

### 2. Configure o Banco de Dados

```bash
cd packages/database

# Crie o arquivo .env
echo "DATABASE_URL=postgresql://user:password@localhost:5432/autostream" > .env

# Instale as dependências
npm install

# Execute as migrações
npm run migrate

# Popule com dados de teste
npm run seed
```

### 3. Configure a API

```bash
cd apps/api

# Crie o arquivo .env
cp .env.example .env

# Instale as dependências
npm install

# Inicie o servidor em modo desenvolvimento
npm run dev
```

A API estará disponível em `http://localhost:3001`

### 4. Configure o Site Público

```bash
cd apps/web

# Crie o arquivo .env
echo "VITE_API_URL=http://localhost:3001" > .env

# Instale as dependências
npm install

# Inicie o servidor
npm run dev
```

O site estará disponível em `http://localhost:5173`

### 5. Configure o Dashboard CRM

```bash
cd apps/dashboard

# Crie o arquivo .env
echo "VITE_API_URL=http://localhost:3001" > .env

# Instale as dependências
npm install

# Inicie o servidor
npm run dev
```

O dashboard estará disponível em `http://localhost:3002`

## 🔑 Credenciais de Teste

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | admin@autostream.com | admin123 |
| Gerente | gerente@autostream.com | gerente123 |
| Vendedor | carlos.silva@autostream.com | vendedor123 |

## 📁 Estrutura do Projeto

### API Endpoints

#### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Dados do usuário logado

#### Leads
- `GET /api/leads` - Listar leads
- `POST /api/leads` - Criar lead (público)
- `GET /api/leads/:id` - Detalhes do lead
- `GET /api/leads/:id/recomendacoes` - Recomendações de vendedores
- `POST /api/leads/:id/atribuir` - Atribuir vendedor

#### Veículos
- `GET /api/veiculos/public` - Listar veículos (público)
- `GET /api/veiculos/destaques` - Veículos em destaque
- `GET /api/veiculos/slug/:slug` - Detalhes do veículo

#### Dashboard
- `GET /api/dashboard/metricas` - Métricas principais
- `GET /api/dashboard/funil` - Dados do funil de vendas
- `GET /api/dashboard/leads-por-dia` - Leads por dia
- `GET /api/dashboard/vendedores` - Ranking de vendedores

## 🤖 Algoritmo de Matching

O sistema utiliza um algoritmo inteligente para recomendar o melhor vendedor para cada lead, baseado em:

1. **Categoria Match (30%)** - Especialidade do vendedor na categoria do veículo
2. **Valor Match (25%)** - Faixa de valor adequada ao nível do vendedor
3. **Nível Match (20%)** - Senior para valores altos, Junior para valores de entrada
4. **Carga Match (15%)** - Disponibilidade do vendedor
5. **Desempenho Match (10%)** - Taxa de conversão histórica

## 🎨 Design System

- **Cores Primárias**: Azul escuro (#1e293b), Laranja/Amber (#f97316)
- **Tipografia**: Inter (Google Fonts)
- **Componentes**: shadcn/ui
- **Ícones**: Lucide React

## 📊 Funcionalidades

### Site Público
- Catálogo de veículos com filtros avançados
- Página de detalhes do veículo
- Formulário de interesse (lead capture)
- Design responsivo (mobile-first)

### Dashboard CRM
- Dashboard com métricas e gráficos
- Gestão de leads com atribuição inteligente
- Gestão de veículos
- Kanban de negociações
- Gestão de vendedores
- Configurações do sistema

## 📝 Licença

Este projeto é privado e destinado apenas para uso interno.

## 👥 Contato

Para suporte ou dúvidas, entre em contato com a equipe de desenvolvimento.