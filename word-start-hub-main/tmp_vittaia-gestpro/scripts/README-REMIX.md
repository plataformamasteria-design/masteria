# 🎯 Guia de Remix do Projeto

Este projeto está totalmente configurado para funcionar imediatamente após o remix!

## ✨ Funcionalidades Automáticas

### 1. **Realtime em Tempo Real**

Todas as tabelas do sistema estão configuradas automaticamente com:

- ✅ REPLICA IDENTITY FULL
- ✅ Publicação no supabase_realtime
- ✅ Atualizações em tempo real funcionando

As seguintes tabelas têm suporte realtime:

- `chats` - Conversas
- `messages` - Mensagens
- `chat_tags` - Tags de conversas
- `lead_follow_up_tracking` - Acompanhamento de follow-up
- `bot_settings` - Configurações do bot
- `follow_up_sequences` - Sequências de follow-up
- `follow_up_steps` - Etapas de follow-up
- `tags` - Tags do sistema
- E mais...

### 2. **Follow-Up Automático**

O sistema de follow-up está configurado para executar a cada minuto:

- ✅ Scheduler automático via cron job
- ✅ Detecção de gatilhos em batch
- ✅ Envio de mensagens programadas
- ✅ Marcação de leads perdidos

### 3. **Webhooks Pré-configurados**

Os seguintes webhooks são criados automaticamente:

- **Follow Up Webhook** - Para envio de mensagens de follow-up
- **Message Sent Webhook** - Para notificação de mensagens enviadas

## 🔧 Configuração Necessária Após Remix

### Passo 0: Personalizar Logo (Opcional)

1. Acesse a aba **Developer** no menu lateral
2. Clique na aba **Config**
3. Faça upload do logo da sua empresa (PNG, JPG ou SVG)
4. O logo será atualizado automaticamente em:
   - Tela de login
   - Tela de autorização pendente
   - Menu lateral
5. Para remover o logo personalizado, clique em "Remover"

### Passo 1: Configurar Webhooks do Sistema

**IMPORTANTE**: Estes webhooks são essenciais para o funcionamento do sistema de follow-up.

1. Acesse a aba **Developer** no menu lateral
2. Clique na aba **Config**
3. Role até a seção "Webhooks do Sistema"
4. Configure os dois webhooks principais:

#### Follow Up Webhook

- **URL padrão**: `https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-follow-up`
- **Função**: Usado pelo scheduler automático para enviar mensagens de follow-up programadas
- **Como usar**:
  1. Altere a URL se você tiver sua própria API
  2. Mantenha a URL padrão se estiver usando o ActusHub
  3. Ative o webhook marcando o switch "Webhook Ativo"
  4. Clique em "Salvar Configurações"

#### Message Sent Webhook

- **URL padrão**: `https://workflow-priscilla.agenciamdsolution.com/webhook/priscila-sent`
- **Função**: Chamado sempre que uma mensagem é enviada pelo sistema
- **Como usar**:
  1. Altere a URL se você tiver sua própria API
  2. Mantenha a URL padrão se estiver usando o ActusHub
  3. Ative o webhook se desejar receber notificações
  4. Clique em "Salvar Configurações"

⚠️ **Atenção**: O sistema de follow-up automático só funcionará se o webhook "Follow Up" estiver ativo e com a URL correta!

### Passo 2: Configurar URLs de Outros Webhooks (Opcional)

Se você criou webhooks personalizados, configure-os na aba **Webhooks** do Developer.

### Passo 3: Criar Tags do Sistema

1. Acesse a aba **Pipeline**
2. Crie as tags necessárias para seu funil de vendas
3. Configure as cores e ícones para organização visual

### Passo 4: Configurar Sequências de Follow-Up

1. Acesse a aba **Follow Up**
2. Crie suas sequências de follow-up
3. Configure:
   - Tags de gatilho (quando iniciar a sequência)
   - Etapas da sequência (mensagens e delays)
   - Tags para cada etapa
4. Ative a sequência quando estiver pronta

### Passo 5: Configurar Analytics (Opcional)

1. Acesse a aba **Dashboard**
2. Configure as tags de início e fim de:
   - Ciclo de vendas
   - Conversão

## 📊 Como Funciona o Sistema

### Follow-Up Automático

1. Quando um lead recebe uma **tag de gatilho**, a sequência inicia automaticamente
2. O sistema agenda o envio da primeira mensagem baseado no delay configurado
3. A cada minuto, o scheduler verifica se há mensagens para enviar
4. Se o lead responder, a sequência é interrompida automaticamente
5. Se completar todas as etapas sem resposta, o lead é marcado como perdido

### Realtime Updates

- Todas as atualizações nas tabelas são refletidas em tempo real na interface
- Chats, mensagens, tags e status de follow-up são sincronizados instantaneamente
- Múltiplos usuários veem as mesmas informações atualizadas

## 🚀 Primeiros Passos Recomendados

1. **Configure os webhooks do sistema** (essencial para follow-up automático)
2. **Personalize o logo** (opcional, mas recomendado para branding)
3. **Crie suas primeiras tags** (para organizar leads)
4. **Configure uma sequência de follow-up simples** (para testar o sistema)
5. **Importe ou adicione alguns leads** (para começar a usar)

## 📝 Notas Importantes

- **Webhooks Follow-up e Sent**: Configurados automaticamente com URLs padrão do ActusHub
- **URLs personalizadas**: Podem ser alteradas a qualquer momento na aba Config
- O sistema de cron executa automaticamente a cada minuto
- Os webhooks precisam estar **ativos** para que as mensagens sejam enviadas
- As permissões de usuário são gerenciadas na aba **Users**
- Todos os dados são armazenados de forma segura com RLS (Row Level Security)
- Alterações nos webhooks são refletidas em tempo real no sistema

## 🔄 Atualizações em Tempo Real

O sistema possui sincronização automática via Realtime para:

- ✅ Configurações de webhooks
- ✅ Logo do sistema
- ✅ Chats e mensagens
- ✅ Tags e etapas de leads
- ✅ Status de follow-up

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs nas Edge Functions (aba Developer)
2. **Confirme que os webhooks do sistema estão ativos** na aba Config
3. Verifique se as URLs dos webhooks estão corretas
4. Confirme que as tags de gatilho estão configuradas corretamente nas sequências

---

**Este projeto está pronto para uso!**

✅ Webhooks pré-configurados com URLs do ActusHub  
✅ Sistema de follow-up automático funcionando  
✅ Realtime habilitado em todas as tabelas  
✅ Logo personalizável

**Basta ativar os webhooks na aba Config e começar a criar suas sequências de follow-up.** 🎉
