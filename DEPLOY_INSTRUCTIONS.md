# Instruções de Deploy - Sistema de Apostas Esportivas

## Problema Encontrado

A ferramenta de deploy automático do Fly.io está selecionando uma região descontinuada ("sea"), impedindo o deploy mesmo após múltiplas tentativas. O sistema está completamente funcional e pronto para deploy com PostgreSQL.

## Solução: Deploy Manual no Render.com

O Render.com oferece PostgreSQL gratuito e é muito simples de configurar. Siga os passos abaixo:

---

## Passo 1: Preparar o Código no GitHub

### 1.1 Criar um repositório no GitHub
1. Acesse https://github.com/new
2. Nome sugerido: `betting-system`
3. Deixe como **Privado** (recomendado)
4. **NÃO** inicialize com README
5. Clique em "Create repository"

### 1.2 Fazer push do código
Execute os seguintes comandos no terminal:

```bash
cd /home/ubuntu/betting-system

# Inicializar git
git init
git add betting-backend/ betting-frontend/
git commit -m "Initial commit: Sports betting system with PostgreSQL"

# Conectar ao seu repositório (substitua SEU_USUARIO pelo seu usuário do GitHub)
git remote add origin https://github.com/SEU_USUARIO/betting-system.git
git branch -M main
git push -u origin main
```

**Nota**: Você precisará de um Personal Access Token (PAT) do GitHub para fazer push. Crie um em: https://github.com/settings/tokens (com permissão "repo")

---

## Passo 2: Deploy do Backend no Render.com

### 2.1 Criar conta no Render
1. Acesse https://render.com
2. Clique em "Get Started" e faça login com GitHub
3. Autorize o Render a acessar seus repositórios

### 2.2 Criar banco de dados PostgreSQL
1. No dashboard do Render, clique em "New +"
2. Selecione "PostgreSQL"
3. Configurações:
   - **Name**: `betting-db`
   - **Database**: `betting_db`
   - **User**: `betting_user`
   - **Region**: Escolha a mais próxima (ex: Ohio ou Oregon)
   - **Plan**: Free
4. Clique em "Create Database"
5. **IMPORTANTE**: Copie a "Internal Database URL" que aparecerá (formato: `postgresql://...`)

### 2.3 Criar Web Service para o Backend
1. No dashboard, clique em "New +"
2. Selecione "Web Service"
3. Conecte seu repositório `betting-system`
4. Configurações:
   - **Name**: `betting-backend`
   - **Region**: Mesma do banco de dados
   - **Root Directory**: `betting-backend`
   - **Runtime**: Python 3
   - **Build Command**: 
     ```
     pip install -U pip && pip install poetry && poetry install --no-root
     ```
   - **Start Command**: 
     ```
     poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: Free

5. **Environment Variables** (clique em "Advanced"):
   - Adicione a variável:
     - **Key**: `DATABASE_URL`
     - **Value**: Cole a "Internal Database URL" que você copiou no passo 2.2

6. Clique em "Create Web Service"

7. Aguarde o deploy (leva ~5 minutos). Quando terminar, você verá uma URL tipo:
   ```
   https://betting-backend-xxxx.onrender.com
   ```
   **Copie esta URL!**

### 2.4 Testar o Backend
Acesse no navegador:
```
https://betting-backend-xxxx.onrender.com/healthz
```

Deve retornar: `{"status":"ok"}`

---

## Passo 3: Deploy do Frontend no Render.com

### 3.1 Atualizar configuração do frontend
No seu terminal, execute:

```bash
cd /home/ubuntu/betting-system/betting-frontend

# Atualizar o arquivo .env com a URL do backend
echo "VITE_API_URL=https://betting-backend-xxxx.onrender.com" > .env

# Fazer commit da mudança
cd /home/ubuntu/betting-system
git add betting-frontend/.env
git commit -m "Update backend URL for production"
git push
```

**IMPORTANTE**: Substitua `betting-backend-xxxx.onrender.com` pela URL real do seu backend!

### 3.2 Criar Static Site para o Frontend
1. No dashboard do Render, clique em "New +"
2. Selecione "Static Site"
3. Conecte o mesmo repositório `betting-system`
4. Configurações:
   - **Name**: `betting-frontend`
   - **Root Directory**: `betting-frontend`
   - **Build Command**: 
     ```
     npm ci && npm run build
     ```
   - **Publish Directory**: `dist`

5. **Environment Variables**:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://betting-backend-xxxx.onrender.com` (URL do backend)

6. Clique em "Create Static Site"

7. Aguarde o deploy (~3 minutos). Você receberá uma URL tipo:
   ```
   https://betting-frontend-xxxx.onrender.com
   ```

---

## Passo 4: Testar o Sistema Completo

1. Acesse a URL do frontend: `https://betting-frontend-xxxx.onrender.com`
2. Teste todas as funcionalidades:
   - ✅ Criar partidas
   - ✅ Criar apostas
   - ✅ Ver estatísticas
   - ✅ Editar e excluir dados
3. **Os dados agora são persistentes!** Mesmo se você fechar o navegador ou o servidor reiniciar, os dados permanecerão no PostgreSQL.

---

## Observações Importantes

### Limitações do Plano Gratuito do Render:
- O backend pode "dormir" após 15 minutos de inatividade
- A primeira requisição após o "sono" pode levar ~30 segundos
- Banco de dados gratuito tem limite de 90 dias (depois precisa renovar)
- Ideal para desenvolvimento e testes

### Dados Persistentes:
- ✅ Todos os dados são salvos no PostgreSQL
- ✅ Dados sobrevivem a reinicializações
- ✅ Backup automático pelo Render

### Próximos Passos (Opcional):
- Fazer upgrade para plano pago ($7/mês) para evitar o "sono"
- Configurar domínio personalizado
- Adicionar autenticação de usuários

---

## Suporte

Se tiver problemas:
1. Verifique os logs no dashboard do Render
2. Confirme que a DATABASE_URL está configurada corretamente
3. Teste o backend diretamente acessando `/healthz`

---

**Sistema desenvolvido com:**
- Backend: FastAPI + PostgreSQL
- Frontend: React + TypeScript + Tailwind CSS
- Deploy: Render.com
