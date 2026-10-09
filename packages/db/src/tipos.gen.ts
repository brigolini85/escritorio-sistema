
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "agente_contatos_teste": {
                  Row: {
                    "agente_id": string,"contato_id": string,"incluido_em": string,"incluido_por": string | null
                  }
                  Insert: {
                    "agente_id": string,"contato_id": string,"incluido_em"?: string,"incluido_por"?: string | null
                  }
                  Update: {
                    "agente_id"?: string,"contato_id"?: string,"incluido_em"?: string,"incluido_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_contatos_teste_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_contatos_teste_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_contatos_teste_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_contatos_teste_incluido_por_fkey"
      columns: ["incluido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_mudancas": {
                  Row: {
                    "agente_id": string,"criado_em": string,"descricao": string,"id": string,"usuario_id": string | null
                  }
                  Insert: {
                    "agente_id": string,"criado_em"?: string,"descricao": string,"id"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "agente_id"?: string,"criado_em"?: string,"descricao"?: string,"id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_mudancas_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_mudancas_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_pendencias": {
                  Row: {
                    "arquivo_id": string | null,"contato_id": string | null,"criado_em": string,"detalhe": string | null,"estado": string,"id": string,"mensagem": string | null,"mensagem_id": string | null,"numero": number,"opcoes": (string)[],"pedido_em": string | null,"pedido_enviado_em": string | null,"pedido_por": string | null,"pedido_texto": string | null,"pedidos": number,"pergunta": string,"repassada_em": string | null,"respondeu_na_conversa_em": string | null,"respondida_em": string | null,"respondida_por": string | null,"resposta": string | null,"tarefa_id": string,"tipo": string,"vista_em": string | null
                  }
                  Insert: {
                    "arquivo_id"?: string | null,"contato_id"?: string | null,"criado_em"?: string,"detalhe"?: string | null,"estado"?: string,"id"?: string,"mensagem"?: string | null,"mensagem_id"?: string | null,"numero": number,"opcoes"?: (string)[],"pedido_em"?: string | null,"pedido_enviado_em"?: string | null,"pedido_por"?: string | null,"pedido_texto"?: string | null,"pedidos"?: number,"pergunta": string,"repassada_em"?: string | null,"respondeu_na_conversa_em"?: string | null,"respondida_em"?: string | null,"respondida_por"?: string | null,"resposta"?: string | null,"tarefa_id": string,"tipo": string,"vista_em"?: string | null
                  }
                  Update: {
                    "arquivo_id"?: string | null,"contato_id"?: string | null,"criado_em"?: string,"detalhe"?: string | null,"estado"?: string,"id"?: string,"mensagem"?: string | null,"mensagem_id"?: string | null,"numero"?: number,"opcoes"?: (string)[],"pedido_em"?: string | null,"pedido_enviado_em"?: string | null,"pedido_por"?: string | null,"pedido_texto"?: string | null,"pedidos"?: number,"pergunta"?: string,"repassada_em"?: string | null,"respondeu_na_conversa_em"?: string | null,"respondida_em"?: string | null,"respondida_por"?: string | null,"resposta"?: string | null,"tarefa_id"?: string,"tipo"?: string,"vista_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_pendencias_arquivo_id_fkey"
      columns: ["arquivo_id"]
isOneToOne: false
      referencedRelation: "agente_tarefa_arquivos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_mensagem_id_fkey"
      columns: ["mensagem_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_pedido_por_fkey"
      columns: ["pedido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_respondida_por_fkey"
      columns: ["respondida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_pendencias_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "agente_tarefas"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_regras_assunto": {
                  Row: {
                    "agente_id": string,"assunto": string,"atualizado_em": string,"criado_em": string,"exemplo": string,"id": string,"modo": string
                  }
                  Insert: {
                    "agente_id": string,"assunto": string,"atualizado_em"?: string,"criado_em"?: string,"exemplo"?: string,"id"?: string,"modo": string
                  }
                  Update: {
                    "agente_id"?: string,"assunto"?: string,"atualizado_em"?: string,"criado_em"?: string,"exemplo"?: string,"id"?: string,"modo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_regras_assunto_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_skill_arquivos": {
                  Row: {
                    "caminho": string,"conteudo": string,"versao_id": string
                  }
                  Insert: {
                    "caminho": string,"conteudo": string,"versao_id": string
                  }
                  Update: {
                    "caminho"?: string,"conteudo"?: string,"versao_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_skill_arquivos_versao_id_fkey"
      columns: ["versao_id"]
isOneToOne: false
      referencedRelation: "agente_skill_versoes"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_skill_versoes": {
                  Row: {
                    "autor_id": string | null,"corpo": string,"criado_em": string,"descricao": string,"id": string,"origem": string,"restaurada_de": number | null,"skill_id": string,"skill_md": string,"tipo": string,"titulo": string,"versao": number
                  }
                  Insert: {
                    "autor_id"?: string | null,"corpo": string,"criado_em"?: string,"descricao": string,"id"?: string,"origem"?: string,"restaurada_de"?: number | null,"skill_id": string,"skill_md": string,"tipo": string,"titulo": string,"versao": number
                  }
                  Update: {
                    "autor_id"?: string | null,"corpo"?: string,"criado_em"?: string,"descricao"?: string,"id"?: string,"origem"?: string,"restaurada_de"?: number | null,"skill_id"?: string,"skill_md"?: string,"tipo"?: string,"titulo"?: string,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_skill_versoes_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_skill_versoes_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "agente_skills"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_skills": {
                  Row: {
                    "agente_id": string,"arquivada_em": string | null,"ativo": boolean,"atualizado_em": string,"criado_em": string,"id": string,"nome": string,"tipo": string,"versao_atual": number
                  }
                  Insert: {
                    "agente_id": string,"arquivada_em"?: string | null,"ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"nome": string,"tipo": string,"versao_atual"?: number
                  }
                  Update: {
                    "agente_id"?: string,"arquivada_em"?: string | null,"ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: string,"nome"?: string,"tipo"?: string,"versao_atual"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_skills_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_sugestoes": {
                  Row: {
                    "agente_id": string,"chamado_id": string,"cliente_id": string | null,"conteudo": NonNullable<Json>,"conversa_id": string | null,"criado_em": string,"decidida_em": string | null,"decidida_por": string | null,"estado": string,"id": string,"tipo": string
                  }
                  Insert: {
                    "agente_id": string,"chamado_id": string,"cliente_id"?: string | null,"conteudo": NonNullable<Json>,"conversa_id"?: string | null,"criado_em"?: string,"decidida_em"?: string | null,"decidida_por"?: string | null,"estado"?: string,"id"?: string,"tipo": string
                  }
                  Update: {
                    "agente_id"?: string,"chamado_id"?: string,"cliente_id"?: string | null,"conteudo"?: NonNullable<Json>,"conversa_id"?: string | null,"criado_em"?: string,"decidida_em"?: string | null,"decidida_por"?: string | null,"estado"?: string,"id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_sugestoes_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "agente_sugestoes_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_sugestoes_decidida_por_fkey"
      columns: ["decidida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_tarefa_arquivos": {
                  Row: {
                    "bucket": string,"caminho": string,"criado_em": string,"detalhe": string | null,"drive_id": string | null,"drive_modificado_em": string | null,"enviado_por": string | null,"id": string,"lido_em": string | null,"mensagem_id": string | null,"mime": string,"nome": string,"origem": string,"removido_em": string | null,"tamanho": number,"tarefa_id": string
                  }
                  Insert: {
                    "bucket": string,"caminho": string,"criado_em"?: string,"detalhe"?: string | null,"drive_id"?: string | null,"drive_modificado_em"?: string | null,"enviado_por"?: string | null,"id"?: string,"lido_em"?: string | null,"mensagem_id"?: string | null,"mime": string,"nome": string,"origem": string,"removido_em"?: string | null,"tamanho": number,"tarefa_id": string
                  }
                  Update: {
                    "bucket"?: string,"caminho"?: string,"criado_em"?: string,"detalhe"?: string | null,"drive_id"?: string | null,"drive_modificado_em"?: string | null,"enviado_por"?: string | null,"id"?: string,"lido_em"?: string | null,"mensagem_id"?: string | null,"mime"?: string,"nome"?: string,"origem"?: string,"removido_em"?: string | null,"tamanho"?: number,"tarefa_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_tarefa_arquivos_enviado_por_fkey"
      columns: ["enviado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefa_arquivos_mensagem_id_fkey"
      columns: ["mensagem_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefa_arquivos_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "agente_tarefas"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_tarefa_avisos": {
                  Row: {
                    "canal": string,"chave": string,"criado_em": string,"enviado_em": string | null,"estado": string,"id": string,"mensagem": string,"motivo": string | null,"pendencias": (number)[],"reservado_em": string | null,"tarefa_id": string,"tipo": string,"usuario_id": string
                  }
                  Insert: {
                    "canal": string,"chave": string,"criado_em"?: string,"enviado_em"?: string | null,"estado"?: string,"id"?: string,"mensagem": string,"motivo"?: string | null,"pendencias"?: (number)[],"reservado_em"?: string | null,"tarefa_id": string,"tipo": string,"usuario_id": string
                  }
                  Update: {
                    "canal"?: string,"chave"?: string,"criado_em"?: string,"enviado_em"?: string | null,"estado"?: string,"id"?: string,"mensagem"?: string,"motivo"?: string | null,"pendencias"?: (number)[],"reservado_em"?: string | null,"tarefa_id"?: string,"tipo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_tarefa_avisos_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "agente_tarefas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefa_avisos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_tarefa_eventos": {
                  Row: {
                    "criado_em": string,"id": string,"quem": string,"tarefa_id": string,"texto": string,"usuario_id": string | null
                  }
                  Insert: {
                    "criado_em"?: string,"id"?: string,"quem": string,"tarefa_id": string,"texto": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"quem"?: string,"tarefa_id"?: string,"texto"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_tarefa_eventos_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "agente_tarefas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefa_eventos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"agente_tarefas": {
                  Row: {
                    "agente_id": string,"ajuste_pendente": boolean,"ajustes": NonNullable<Json>,"anotacoes": string,"atualizado_em": string,"avisar_painel": boolean,"avisar_whatsapp": boolean,"canal": string,"chamado_id": string,"chave_pedido": string | null,"cliente_id": string | null,"criado_em": string,"custo_etapas": NonNullable<Json>,"custo_usd": number,"decidida_em": string | null,"decidida_por": string | null,"drive_subpasta": string | null,"estado": string,"etapa_atual": number,"etapas": NonNullable<Json>,"executando_desde": string | null,"id": string,"ler_drive": boolean,"limite_minutos": number,"limite_usd": number,"motivo_pausa": string | null,"numero": number,"pedida_por": string | null,"pedido": string,"prazo_desejado": string | null,"resultado": Json | null,"segundos_trabalhando": number,"setor_id": string | null,"skill_nome": string | null
                  }
                  Insert: {
                    "agente_id": string,"ajuste_pendente"?: boolean,"ajustes"?: NonNullable<Json>,"anotacoes"?: string,"atualizado_em"?: string,"avisar_painel"?: boolean,"avisar_whatsapp"?: boolean,"canal"?: string,"chamado_id": string,"chave_pedido"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"custo_etapas"?: NonNullable<Json>,"custo_usd"?: number,"decidida_em"?: string | null,"decidida_por"?: string | null,"drive_subpasta"?: string | null,"estado"?: string,"etapa_atual"?: number,"etapas"?: NonNullable<Json>,"executando_desde"?: string | null,"id"?: string,"ler_drive"?: boolean,"limite_minutos": number,"limite_usd": number,"motivo_pausa"?: string | null,"numero"?: never,"pedida_por"?: string | null,"pedido": string,"prazo_desejado"?: string | null,"resultado"?: Json | null,"segundos_trabalhando"?: number,"setor_id"?: string | null,"skill_nome"?: string | null
                  }
                  Update: {
                    "agente_id"?: string,"ajuste_pendente"?: boolean,"ajustes"?: NonNullable<Json>,"anotacoes"?: string,"atualizado_em"?: string,"avisar_painel"?: boolean,"avisar_whatsapp"?: boolean,"canal"?: string,"chamado_id"?: string,"chave_pedido"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"custo_etapas"?: NonNullable<Json>,"custo_usd"?: number,"decidida_em"?: string | null,"decidida_por"?: string | null,"drive_subpasta"?: string | null,"estado"?: string,"etapa_atual"?: number,"etapas"?: NonNullable<Json>,"executando_desde"?: string | null,"id"?: string,"ler_drive"?: boolean,"limite_minutos"?: number,"limite_usd"?: number,"motivo_pausa"?: string | null,"numero"?: never,"pedida_por"?: string | null,"pedido"?: string,"prazo_desejado"?: string | null,"resultado"?: Json | null,"segundos_trabalhando"?: number,"setor_id"?: string | null,"skill_nome"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agente_tarefas_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_decidida_por_fkey"
      columns: ["decidida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_pedida_por_fkey"
      columns: ["pedida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agente_tarefas_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"agentes": {
                  Row: {
                    "atualizado_em": string,"atualizado_por": string | null,"criado_em": string,"descricao": string,"estado": string,"ferramentas": (string)[],"id": string,"modelo": string | null,"modo_contato": string | null,"nome": string,"ordem": number,"porta_de_entrada": boolean,"setor_id": string | null,"slug": string,"tarefa_limite_minutos": number,"tarefa_limite_usd": number,"tipos": (string)[]
                  }
                  Insert: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"descricao"?: string,"estado"?: string,"ferramentas"?: (string)[],"id"?: string,"modelo"?: string | null,"modo_contato"?: string | null,"nome": string,"ordem"?: number,"porta_de_entrada"?: boolean,"setor_id"?: string | null,"slug": string,"tarefa_limite_minutos"?: number,"tarefa_limite_usd"?: number,"tipos"?: (string)[]
                  }
                  Update: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"criado_em"?: string,"descricao"?: string,"estado"?: string,"ferramentas"?: (string)[],"id"?: string,"modelo"?: string | null,"modo_contato"?: string | null,"nome"?: string,"ordem"?: number,"porta_de_entrada"?: boolean,"setor_id"?: string | null,"slug"?: string,"tarefa_limite_minutos"?: number,"tarefa_limite_usd"?: number,"tipos"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "agentes_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agentes_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"alertas": {
                  Row: {
                    "criado_em": string,"id": string,"lido_em": string | null,"mensagem": string,"nivel": string,"setor_id": string | null,"usuario_id": string | null
                  }
                  Insert: {
                    "criado_em"?: string,"id"?: string,"lido_em"?: string | null,"mensagem": string,"nivel": string,"setor_id"?: string | null,"usuario_id"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"lido_em"?: string | null,"mensagem"?: string,"nivel"?: string,"setor_id"?: string | null,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alertas_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alertas_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"assistente_mensagens": {
                  Row: {
                    "arquivo": Json | null,"canal": string,"conteudo": string,"conversa_id": string | null,"criado_em": string,"id": string,"papel": string,"processada_em": string | null,"usuario_id": string
                  }
                  Insert: {
                    "arquivo"?: Json | null,"canal": string,"conteudo": string,"conversa_id"?: string | null,"criado_em"?: string,"id"?: string,"papel": string,"processada_em"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "arquivo"?: Json | null,"canal"?: string,"conteudo"?: string,"conversa_id"?: string | null,"criado_em"?: string,"id"?: string,"papel"?: string,"processada_em"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistente_mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistente_mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "assistente_mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assistente_mensagens_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"auditoria_acessos": {
                  Row: {
                    "acao": string,"criado_em": string,"detalhes": Json | null,"entidade": string,"entidade_id": string | null,"id": string,"usuario_id": string | null
                  }
                  Insert: {
                    "acao": string,"criado_em"?: string,"detalhes"?: Json | null,"entidade": string,"entidade_id"?: string | null,"id"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"criado_em"?: string,"detalhes"?: Json | null,"entidade"?: string,"entidade_id"?: string | null,"id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"avisos_limite_dia": {
                  Row: {
                    "dia": string,"telefone_hash": string
                  }
                  Insert: {
                    "dia": string,"telefone_hash": string
                  }
                  Update: {
                    "dia"?: string,"telefone_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"avisos_unicos": {
                  Row: {
                    "chave": string,"criado_em": string
                  }
                  Insert: {
                    "chave": string,"criado_em"?: string
                  }
                  Update: {
                    "chave"?: string,"criado_em"?: string
                  }
                  Relationships: [
                    
                  ]
                },"certificado_avisos": {
                  Row: {
                    "chamado_id": string | null,"cliente_id": string,"criado_em": string,"vencimento": string
                  }
                  Insert: {
                    "chamado_id"?: string | null,"cliente_id": string,"criado_em"?: string,"vencimento": string
                  }
                  Update: {
                    "chamado_id"?: string | null,"cliente_id"?: string,"criado_em"?: string,"vencimento"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificado_avisos_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificado_avisos_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificado_avisos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"chamado_eventos": {
                  Row: {
                    "chamado_id": string,"cliente_id": string | null,"criado_em": string,"id": string,"texto": string | null,"tipo": string,"usuario_id": string | null
                  }
                  Insert: {
                    "chamado_id": string,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"texto"?: string | null,"tipo": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "chamado_id"?: string,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"texto"?: string | null,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chamado_eventos_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamado_eventos_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamado_eventos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamado_eventos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"chamados": {
                  Row: {
                    "alertado_fila_em": string | null,"alertado_vencimento_em": string | null,"atualizado_em": string,"cliente_id": string | null,"concluido_em": string | null,"contato_id": string | null,"conversa_id": string | null,"criado_em": string,"criado_por": string | null,"fora_do_contrato": boolean,"id": string,"numero": number,"origem": string,"pedido_venda": Json | null,"prazo_em": string | null,"prazo_pausado_desde": string | null,"prioridade": Database["public"]['Enums']["prioridade_demanda"],"responsavel_id": string | null,"resumo": string,"setor_id": string | null,"status": Database["public"]['Enums']["status_chamado"],"titulo": string
                  }
                  Insert: {
                    "alertado_fila_em"?: string | null,"alertado_vencimento_em"?: string | null,"atualizado_em"?: string,"cliente_id"?: string | null,"concluido_em"?: string | null,"contato_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"fora_do_contrato"?: boolean,"id"?: string,"numero"?: never,"origem"?: string,"pedido_venda"?: Json | null,"prazo_em"?: string | null,"prazo_pausado_desde"?: string | null,"prioridade"?: Database["public"]['Enums']["prioridade_demanda"],"responsavel_id"?: string | null,"resumo"?: string,"setor_id"?: string | null,"status"?: Database["public"]['Enums']["status_chamado"],"titulo": string
                  }
                  Update: {
                    "alertado_fila_em"?: string | null,"alertado_vencimento_em"?: string | null,"atualizado_em"?: string,"cliente_id"?: string | null,"concluido_em"?: string | null,"contato_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"fora_do_contrato"?: boolean,"id"?: string,"numero"?: never,"origem"?: string,"pedido_venda"?: Json | null,"prazo_em"?: string | null,"prazo_pausado_desde"?: string | null,"prioridade"?: Database["public"]['Enums']["prioridade_demanda"],"responsavel_id"?: string | null,"resumo"?: string,"setor_id"?: string | null,"status"?: Database["public"]['Enums']["status_chamado"],"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chamados_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"cliente_acessos": {
                  Row: {
                    "atualizado_em": string,"atualizado_por": string | null,"cliente_id": string,"id": string,"portal": string,"senha_cifrada": string | null,"tem_senha": boolean | null,"usuario": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id": string,"id"?: string,"portal": string,"senha_cifrada"?: string | null,"tem_senha"?: never,"usuario"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id"?: string,"id"?: string,"portal"?: string,"senha_cifrada"?: string | null,"tem_senha"?: never,"usuario"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_acessos_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_acessos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"cliente_inscricoes_st": {
                  Row: {
                    "cliente_id": string,"inscricao": string | null,"uf": string
                  }
                  Insert: {
                    "cliente_id": string,"inscricao"?: string | null,"uf": string
                  }
                  Update: {
                    "cliente_id"?: string,"inscricao"?: string | null,"uf"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_inscricoes_st_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"cliente_responsaveis": {
                  Row: {
                    "cliente_id": string,"setor_id": string,"usuario_id": string
                  }
                  Insert: {
                    "cliente_id": string,"setor_id": string,"usuario_id": string
                  }
                  Update: {
                    "cliente_id"?: string,"setor_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_responsaveis_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_responsaveis_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_responsaveis_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"cliente_servicos": {
                  Row: {
                    "cliente_id": string,"servico_id": string
                  }
                  Insert: {
                    "cliente_id": string,"servico_id": string
                  }
                  Update: {
                    "cliente_id"?: string,"servico_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cliente_servicos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cliente_servicos_servico_id_fkey"
      columns: ["servico_id"]
isOneToOne: false
      referencedRelation: "servicos"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "agente_pausado": boolean,"arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"bairro": string | null,"celular": string | null,"cep": string | null,"certificado_avisar_dias": number,"certificado_tipo": string | null,"certificado_vencimento": string | null,"cidade": string | null,"cnae_principal": string | null,"cnpj": string,"complemento": string | null,"contrato_fim": string | null,"contrato_inicio": string | null,"criado_em": string,"decimo_terceiro": boolean | null,"dia_vencimento": number | null,"drive_pasta_id": string | null,"email": string | null,"email_cobranca": string | null,"endereco": string | null,"faturamento_ultimo_ano": number | null,"funcionarios": number | null,"honorario_mensal": number | null,"id": string,"inscricao_estadual": string | null,"inscricao_municipal": string | null,"inscricao_suframa": string | null,"isento_ie": boolean,"logradouro": string | null,"nome_fantasia": string | null,"numero": string | null,"porte": string | null,"razao_social": string,"reajuste": string | null,"reajuste_mes": number | null,"regime": string | null,"segmentos": (string)[],"site": string | null,"telefone": string | null,"tipo_pessoa": string,"uf": string | null
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"bairro"?: string | null,"celular"?: string | null,"cep"?: string | null,"certificado_avisar_dias"?: number,"certificado_tipo"?: string | null,"certificado_vencimento"?: string | null,"cidade"?: string | null,"cnae_principal"?: string | null,"cnpj": string,"complemento"?: string | null,"contrato_fim"?: string | null,"contrato_inicio"?: string | null,"criado_em"?: string,"decimo_terceiro"?: boolean | null,"dia_vencimento"?: number | null,"drive_pasta_id"?: string | null,"email"?: string | null,"email_cobranca"?: string | null,"endereco"?: string | null,"faturamento_ultimo_ano"?: number | null,"funcionarios"?: number | null,"honorario_mensal"?: number | null,"id"?: string,"inscricao_estadual"?: string | null,"inscricao_municipal"?: string | null,"inscricao_suframa"?: string | null,"isento_ie"?: boolean,"logradouro"?: string | null,"nome_fantasia"?: string | null,"numero"?: string | null,"porte"?: string | null,"razao_social": string,"reajuste"?: string | null,"reajuste_mes"?: number | null,"regime"?: string | null,"segmentos"?: (string)[],"site"?: string | null,"telefone"?: string | null,"tipo_pessoa"?: string,"uf"?: string | null
                  }
                  Update: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"bairro"?: string | null,"celular"?: string | null,"cep"?: string | null,"certificado_avisar_dias"?: number,"certificado_tipo"?: string | null,"certificado_vencimento"?: string | null,"cidade"?: string | null,"cnae_principal"?: string | null,"cnpj"?: string,"complemento"?: string | null,"contrato_fim"?: string | null,"contrato_inicio"?: string | null,"criado_em"?: string,"decimo_terceiro"?: boolean | null,"dia_vencimento"?: number | null,"drive_pasta_id"?: string | null,"email"?: string | null,"email_cobranca"?: string | null,"endereco"?: string | null,"faturamento_ultimo_ano"?: number | null,"funcionarios"?: number | null,"honorario_mensal"?: number | null,"id"?: string,"inscricao_estadual"?: string | null,"inscricao_municipal"?: string | null,"inscricao_suframa"?: string | null,"isento_ie"?: boolean,"logradouro"?: string | null,"nome_fantasia"?: string | null,"numero"?: string | null,"porte"?: string | null,"razao_social"?: string,"reajuste"?: string | null,"reajuste_mes"?: number | null,"regime"?: string | null,"segmentos"?: (string)[],"site"?: string | null,"telefone"?: string | null,"tipo_pessoa"?: string,"uf"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracoes": {
                  Row: {
                    "agente_pausado": boolean,"alerta_ia_80_mes": string | null,"ambiente": string | null,"aviso_login": string,"cargos": (string)[],"cotacao_usd_brl": number | null,"custo_minuto_transcricao_usd": number | null,"dados_pagamento": NonNullable<Json>,"dias_uteis": (number)[],"email_alertas": string | null,"espera_ambar_min": number,"espera_verde_min": number,"horario_fim": string,"horario_inicio": string,"id": number,"limite_dia_contato_usd": number,"limite_dia_desconhecido_usd": number,"mensagens": NonNullable<Json>,"minutos_alerta_fila": number,"modelo_conversa": string,"modelo_rapido": string,"prazo_alta_dias": number,"prazo_baixa_dias": number,"prazo_normal_dias": number,"prazo_urgente_dias": number,"precos_modelos": NonNullable<Json>,"telefone_dono": string | null,"teto_ia_usd": number
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"ambiente"?: string | null,"aviso_login"?: string,"cargos"?: (string)[],"cotacao_usd_brl"?: number | null,"custo_minuto_transcricao_usd"?: number | null,"dados_pagamento"?: NonNullable<Json>,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"espera_ambar_min"?: number,"espera_verde_min"?: number,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"limite_dia_contato_usd"?: number,"limite_dia_desconhecido_usd"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"prazo_alta_dias"?: number,"prazo_baixa_dias"?: number,"prazo_normal_dias"?: number,"prazo_urgente_dias"?: number,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
                  }
                  Update: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"ambiente"?: string | null,"aviso_login"?: string,"cargos"?: (string)[],"cotacao_usd_brl"?: number | null,"custo_minuto_transcricao_usd"?: number | null,"dados_pagamento"?: NonNullable<Json>,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"espera_ambar_min"?: number,"espera_verde_min"?: number,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"limite_dia_contato_usd"?: number,"limite_dia_desconhecido_usd"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"prazo_alta_dias"?: number,"prazo_baixa_dias"?: number,"prazo_normal_dias"?: number,"prazo_urgente_dias"?: number,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
                  }
                  Relationships: [
                    
                  ]
                },"confirmacoes_cliente": {
                  Row: {
                    "cliente_id": string,"contato_id": string,"conversa_id": string,"criado_em": string,"dados": NonNullable<Json>,"expira_em": string,"id": string,"mensagem_pergunta_id": string,"tipo": string,"turno": string,"usado_em": string | null,"valor_antigo": number | null
                  }
                  Insert: {
                    "cliente_id": string,"contato_id": string,"conversa_id": string,"criado_em"?: string,"dados": NonNullable<Json>,"expira_em"?: string,"id"?: string,"mensagem_pergunta_id": string,"tipo": string,"turno": string,"usado_em"?: string | null,"valor_antigo"?: number | null
                  }
                  Update: {
                    "cliente_id"?: string,"contato_id"?: string,"conversa_id"?: string,"criado_em"?: string,"dados"?: NonNullable<Json>,"expira_em"?: string,"id"?: string,"mensagem_pergunta_id"?: string,"tipo"?: string,"turno"?: string,"usado_em"?: string | null,"valor_antigo"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "confirmacoes_cliente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmacoes_cliente_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmacoes_cliente_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmacoes_cliente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmacoes_cliente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "confirmacoes_cliente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmacoes_cliente_mensagem_pergunta_id_fkey"
      columns: ["mensagem_pergunta_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    }
                  ]
                },"contato_cliente_setores": {
                  Row: {
                    "cliente_id": string,"contato_id": string,"pode_ser_procurado": boolean,"setor_id": string
                  }
                  Insert: {
                    "cliente_id": string,"contato_id": string,"pode_ser_procurado"?: boolean,"setor_id": string
                  }
                  Update: {
                    "cliente_id"?: string,"contato_id"?: string,"pode_ser_procurado"?: boolean,"setor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contato_cliente_setores_contato_id_cliente_id_fkey"
      columns: ["contato_id","cliente_id"]
isOneToOne: false
      referencedRelation: "contato_clientes"
      referencedColumns: ["contato_id","cliente_id"]
    },{
      foreignKeyName: "contato_cliente_setores_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"contato_clientes": {
                  Row: {
                    "avisar_documento_novo": (string)[],"cliente_id": string,"contato_id": string,"perfil": string,"pode_atualizar_preco": boolean,"pode_pedir_nota": boolean,"recebe_alertas_acesso": boolean,"receber_documentos": boolean,"ver_valores": boolean
                  }
                  Insert: {
                    "avisar_documento_novo"?: (string)[],"cliente_id": string,"contato_id": string,"perfil"?: string,"pode_atualizar_preco"?: boolean,"pode_pedir_nota"?: boolean,"recebe_alertas_acesso"?: boolean,"receber_documentos"?: boolean,"ver_valores"?: boolean
                  }
                  Update: {
                    "avisar_documento_novo"?: (string)[],"cliente_id"?: string,"contato_id"?: string,"perfil"?: string,"pode_atualizar_preco"?: boolean,"pode_pedir_nota"?: boolean,"recebe_alertas_acesso"?: boolean,"receber_documentos"?: boolean,"ver_valores"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "contato_clientes_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contato_clientes_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contato_clientes_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    }
                  ]
                },"contatos": {
                  Row: {
                    "agente_pausado": boolean,"arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cargo": string | null,"criado_em": string,"email": string | null,"id": string,"nome": string,"telefone": string
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome": string,"telefone": string
                  }
                  Update: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"email"?: string | null,"id"?: string,"nome"?: string,"telefone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contatos_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"conversa_eventos": {
                  Row: {
                    "conversa_id": string,"criado_em": string,"id": string,"texto": string | null,"tipo": string,"usuario_id": string | null
                  }
                  Insert: {
                    "conversa_id": string,"criado_em"?: string,"id"?: string,"texto"?: string | null,"tipo": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "conversa_id"?: string,"criado_em"?: string,"id"?: string,"texto"?: string | null,"tipo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversa_eventos_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversa_eventos_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "conversa_eventos_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversa_eventos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"conversa_leituras": {
                  Row: {
                    "conversa_id": string,"lida_ate": string,"usuario_id": string
                  }
                  Insert: {
                    "conversa_id": string,"lida_ate": string,"usuario_id": string
                  }
                  Update: {
                    "conversa_id"?: string,"lida_ate"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversa_leituras_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversa_leituras_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "conversa_leituras_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversa_leituras_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"conversas": {
                  Row: {
                    "agente_conduzindo_id": string | null,"aguardando_pessoa_desde": string | null,"atendente_id": string | null,"atualizado_em": string,"aviso_lgpd_enviado_em": string | null,"cliente_em_foco": string | null,"concluida_em": string | null,"conduzindo_desde": string | null,"contato_id": string | null,"contato_trocado_em": string | null,"criado_em": string,"estado": Database["public"]['Enums']["estado_conversa"],"id": string,"motivo_pessoa": string | null,"telefone": string,"tentativas_nao_entendido": number
                  }
                  Insert: {
                    "agente_conduzindo_id"?: string | null,"aguardando_pessoa_desde"?: string | null,"atendente_id"?: string | null,"atualizado_em"?: string,"aviso_lgpd_enviado_em"?: string | null,"cliente_em_foco"?: string | null,"concluida_em"?: string | null,"conduzindo_desde"?: string | null,"contato_id"?: string | null,"contato_trocado_em"?: string | null,"criado_em"?: string,"estado"?: Database["public"]['Enums']["estado_conversa"],"id"?: string,"motivo_pessoa"?: string | null,"telefone": string,"tentativas_nao_entendido"?: number
                  }
                  Update: {
                    "agente_conduzindo_id"?: string | null,"aguardando_pessoa_desde"?: string | null,"atendente_id"?: string | null,"atualizado_em"?: string,"aviso_lgpd_enviado_em"?: string | null,"cliente_em_foco"?: string | null,"concluida_em"?: string | null,"conduzindo_desde"?: string | null,"contato_id"?: string | null,"contato_trocado_em"?: string | null,"criado_em"?: string,"estado"?: Database["public"]['Enums']["estado_conversa"],"id"?: string,"motivo_pessoa"?: string | null,"telefone"?: string,"tentativas_nao_entendido"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversas_agente_conduzindo_id_fkey"
      columns: ["agente_conduzindo_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversas_atendente_id_fkey"
      columns: ["atendente_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversas_cliente_em_foco_fkey"
      columns: ["cliente_em_foco"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversas_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversas_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    }
                  ]
                },"decisoes_agente": {
                  Row: {
                    "agente_id": string | null,"cliente_id": string | null,"conversa_id": string | null,"criado_em": string,"entrada": Json | null,"etapa": string,"id": string,"justificativa": string | null,"saida": Json | null,"turno": string | null
                  }
                  Insert: {
                    "agente_id"?: string | null,"cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"entrada"?: Json | null,"etapa": string,"id"?: string,"justificativa"?: string | null,"saida"?: Json | null,"turno"?: string | null
                  }
                  Update: {
                    "agente_id"?: string | null,"cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"entrada"?: Json | null,"etapa"?: string,"id"?: string,"justificativa"?: string | null,"saida"?: Json | null,"turno"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisoes_agente_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisoes_agente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisoes_agente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisoes_agente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "decisoes_agente_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos_empresa": {
                  Row: {
                    "arquivo_mime": string,"arquivo_nome": string,"arquivo_path": string,"cliente_id": string,"criado_em": string,"enviado_por": string | null,"ia_pode_enviar": boolean,"id": string,"nome": string,"setor_id": string | null,"tem_valores": boolean
                  }
                  Insert: {
                    "arquivo_mime"?: string,"arquivo_nome": string,"arquivo_path": string,"cliente_id": string,"criado_em"?: string,"enviado_por"?: string | null,"ia_pode_enviar"?: boolean,"id"?: string,"nome": string,"setor_id"?: string | null,"tem_valores"?: boolean
                  }
                  Update: {
                    "arquivo_mime"?: string,"arquivo_nome"?: string,"arquivo_path"?: string,"cliente_id"?: string,"criado_em"?: string,"enviado_por"?: string | null,"ia_pode_enviar"?: boolean,"id"?: string,"nome"?: string,"setor_id"?: string | null,"tem_valores"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "documentos_empresa_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_empresa_enviado_por_fkey"
      columns: ["enviado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documentos_empresa_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"drive_conta": {
                  Row: {
                    "email": string | null,"erro": string | null,"id": number,"verificado_em": string
                  }
                  Insert: {
                    "email"?: string | null,"erro"?: string | null,"id"?: number,"verificado_em"?: string
                  }
                  Update: {
                    "email"?: string | null,"erro"?: string | null,"id"?: number,"verificado_em"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feriados": {
                  Row: {
                    "data": string,"descricao": string
                  }
                  Insert: {
                    "data": string,"descricao": string
                  }
                  Update: {
                    "data"?: string,"descricao"?: string
                  }
                  Relationships: [
                    
                  ]
                },"instancias_trabalhador": {
                  Row: {
                    "ambiente": string,"build_em": string | null,"hostname": string,"id": string,"iniciado_em": string,"versao": string,"visto_em": string
                  }
                  Insert: {
                    "ambiente": string,"build_em"?: string | null,"hostname": string,"id": string,"iniciado_em"?: string,"versao": string,"visto_em"?: string
                  }
                  Update: {
                    "ambiente"?: string,"build_em"?: string | null,"hostname"?: string,"id"?: string,"iniciado_em"?: string,"versao"?: string,"visto_em"?: string
                  }
                  Relationships: [
                    
                  ]
                },"limite_envio_sistema": {
                  Row: {
                    "minuto": string,"total": number
                  }
                  Insert: {
                    "minuto": string,"total": number
                  }
                  Update: {
                    "minuto"?: string,"total"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mensagens": {
                  Row: {
                    "arquivo_mime": string | null,"arquivo_nome": string | null,"arquivo_path": string | null,"atendente_id": string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id": string | null,"conteudo": string | null,"conversa_id": string,"criado_em": string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"documento_id": string | null,"envio_reservado_em": string | null,"envio_tentado_em": string | null,"id": string,"id_provedor": string | null,"midia_url_origem": string | null,"processada_em": string | null,"reenfileirada": number,"reenfileirada_em": string | null,"status_envio": Database["public"]['Enums']["status_envio"] | null,"tipo": Database["public"]['Enums']["tipo_mensagem"],"transcricao": string | null,"turno_agente": string | null,"turno_agente_entrada": string | null,"turno_agente_entrada_em": string | null
                  }
                  Insert: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id": string,"criado_em"?: string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"documento_id"?: string | null,"envio_reservado_em"?: string | null,"envio_tentado_em"?: string | null,"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"reenfileirada"?: number,"reenfileirada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null,"turno_agente"?: string | null,"turno_agente_entrada"?: string | null,"turno_agente_entrada_em"?: string | null
                  }
                  Update: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor"?: Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id"?: string,"criado_em"?: string,"direcao"?: Database["public"]['Enums']["direcao_mensagem"],"documento_id"?: string | null,"envio_reservado_em"?: string | null,"envio_tentado_em"?: string | null,"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"reenfileirada"?: number,"reenfileirada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null,"turno_agente"?: string | null,"turno_agente_entrada"?: string | null,"turno_agente_entrada_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mensagens_atendente_id_fkey"
      columns: ["atendente_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensagens_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "mensagens_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensagens_documento_id_fkey"
      columns: ["documento_id"]
isOneToOne: false
      referencedRelation: "documentos_empresa"
      referencedColumns: ["id"]
    }
                  ]
                },"orientacoes_agente": {
                  Row: {
                    "agente_id": string,"ativo": boolean,"atualizado_em": string,"atualizado_por": string | null,"cliente_id": string | null,"criado_em": string,"criado_por": string | null,"id": string,"setor_id": string | null,"texto": string,"tipo": string,"titulo": string
                  }
                  Insert: {
                    "agente_id"?: string,"ativo"?: boolean,"atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"setor_id"?: string | null,"texto": string,"tipo": string,"titulo": string
                  }
                  Update: {
                    "agente_id"?: string,"ativo"?: boolean,"atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"setor_id"?: string | null,"texto"?: string,"tipo"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orientacoes_agente_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orientacoes_agente_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orientacoes_agente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orientacoes_agente_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orientacoes_agente_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"orientacoes_agente_versoes": {
                  Row: {
                    "acao": string,"ativo": boolean,"cliente_id": string | null,"criado_em": string,"id": string,"orientacao_id": string,"setor_id": string | null,"texto": string,"tipo": string,"titulo": string,"usuario_id": string | null
                  }
                  Insert: {
                    "acao": string,"ativo": boolean,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"orientacao_id": string,"setor_id"?: string | null,"texto": string,"tipo": string,"titulo": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "acao"?: string,"ativo"?: boolean,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"orientacao_id"?: string,"setor_id"?: string | null,"texto"?: string,"tipo"?: string,"titulo"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orientacoes_agente_versoes_orientacao_id_fkey"
      columns: ["orientacao_id"]
isOneToOne: false
      referencedRelation: "orientacoes_agente"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orientacoes_agente_versoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"parceiros_grupos": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cliente_id": string,"criado_em": string,"id": string,"nome": string,"palavras_chave": (string)[],"tipo": Database["public"]['Enums']["tipo_parceiro"]
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cliente_id": string,"criado_em"?: string,"id"?: string,"nome": string,"palavras_chave"?: (string)[],"tipo": Database["public"]['Enums']["tipo_parceiro"]
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cliente_id"?: string,"criado_em"?: string,"id"?: string,"nome"?: string,"palavras_chave"?: (string)[],"tipo"?: Database["public"]['Enums']["tipo_parceiro"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "parceiros_grupos_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parceiros_grupos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"parceiros_unidades": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"bairro": string | null,"cep": string | null,"cidade": string | null,"cliente_id": string,"cnpj": string | null,"complemento": string | null,"criado_em": string,"endereco": string | null,"grupo_id": string,"id": string,"inscricao_estadual": string | null,"nome_unidade": string,"numero": string | null,"palavras_chave": (string)[],"razao_social": string | null,"telefone": string | null,"uf": string | null
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"bairro"?: string | null,"cep"?: string | null,"cidade"?: string | null,"cliente_id": string,"cnpj"?: string | null,"complemento"?: string | null,"criado_em"?: string,"endereco"?: string | null,"grupo_id": string,"id"?: string,"inscricao_estadual"?: string | null,"nome_unidade": string,"numero"?: string | null,"palavras_chave"?: (string)[],"razao_social"?: string | null,"telefone"?: string | null,"uf"?: string | null
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"bairro"?: string | null,"cep"?: string | null,"cidade"?: string | null,"cliente_id"?: string,"cnpj"?: string | null,"complemento"?: string | null,"criado_em"?: string,"endereco"?: string | null,"grupo_id"?: string,"id"?: string,"inscricao_estadual"?: string | null,"nome_unidade"?: string,"numero"?: string | null,"palavras_chave"?: (string)[],"razao_social"?: string | null,"telefone"?: string | null,"uf"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "parceiros_unidades_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parceiros_unidades_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parceiros_unidades_grupo_id_cliente_id_fkey"
      columns: ["grupo_id","cliente_id"]
isOneToOne: false
      referencedRelation: "parceiros_grupos"
      referencedColumns: ["id","cliente_id"]
    }
                  ]
                },"pedidos_fora_do_acesso": {
                  Row: {
                    "chamado_id": string | null,"cliente_id": string,"contato_id": string,"criado_em": string,"dia": string,"id": string,"setor_id": string,"socios_avisados": number,"vezes": number
                  }
                  Insert: {
                    "chamado_id"?: string | null,"cliente_id": string,"contato_id": string,"criado_em"?: string,"dia": string,"id"?: string,"setor_id": string,"socios_avisados"?: number,"vezes"?: number
                  }
                  Update: {
                    "chamado_id"?: string | null,"cliente_id"?: string,"contato_id"?: string,"criado_em"?: string,"dia"?: string,"id"?: string,"setor_id"?: string,"socios_avisados"?: number,"vezes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_fora_do_acesso_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_fora_do_acesso_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_fora_do_acesso_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_fora_do_acesso_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_fora_do_acesso_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_fora_do_acesso_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"pedidos_nota_resumo": {
                  Row: {
                    "chamado_id": string | null,"cliente_id": string,"conversa_id": string,"criado_em": string,"hash": string,"id": string,"mensagem_resumo_id": string,"pedido": NonNullable<Json>,"turno": string,"usado_em": string | null
                  }
                  Insert: {
                    "chamado_id"?: string | null,"cliente_id": string,"conversa_id": string,"criado_em"?: string,"hash": string,"id"?: string,"mensagem_resumo_id": string,"pedido": NonNullable<Json>,"turno": string,"usado_em"?: string | null
                  }
                  Update: {
                    "chamado_id"?: string | null,"cliente_id"?: string,"conversa_id"?: string,"criado_em"?: string,"hash"?: string,"id"?: string,"mensagem_resumo_id"?: string,"pedido"?: NonNullable<Json>,"turno"?: string,"usado_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_nota_resumo_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_nota_resumo_mensagem_resumo_id_fkey"
      columns: ["mensagem_resumo_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    }
                  ]
                },"permissao_niveis": {
                  Row: {
                    "modulo": string,"nivel": string,"ordem": number
                  }
                  Insert: {
                    "modulo": string,"nivel": string,"ordem": number
                  }
                  Update: {
                    "modulo"?: string,"nivel"?: string,"ordem"?: number
                  }
                  Relationships: [
                    
                  ]
                },"pre_analises_nota": {
                  Row: {
                    "agente_id": string | null,"atualizado_em": string,"chamado_id": string,"cliente_id": string | null,"criado_em": string,"id": string,"resultado": NonNullable<Json>,"versao": number
                  }
                  Insert: {
                    "agente_id"?: string | null,"atualizado_em"?: string,"chamado_id": string,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"resultado": NonNullable<Json>,"versao"?: number
                  }
                  Update: {
                    "agente_id"?: string | null,"atualizado_em"?: string,"chamado_id"?: string,"cliente_id"?: string | null,"criado_em"?: string,"id"?: string,"resultado"?: NonNullable<Json>,"versao"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pre_analises_nota_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pre_analises_nota_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: true
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pre_analises_nota_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: true
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pre_analises_nota_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"precos": {
                  Row: {
                    "alterado_por": string | null,"alterado_por_contato": string | null,"cliente_id": string,"criado_em": string,"grupo_id": string,"id": string,"origem": string,"produto_id": string,"valor": number,"vigente_ate": string | null,"vigente_desde": string
                  }
                  Insert: {
                    "alterado_por"?: string | null,"alterado_por_contato"?: string | null,"cliente_id": string,"criado_em"?: string,"grupo_id": string,"id"?: string,"origem"?: string,"produto_id": string,"valor": number,"vigente_ate"?: string | null,"vigente_desde"?: string
                  }
                  Update: {
                    "alterado_por"?: string | null,"alterado_por_contato"?: string | null,"cliente_id"?: string,"criado_em"?: string,"grupo_id"?: string,"id"?: string,"origem"?: string,"produto_id"?: string,"valor"?: number,"vigente_ate"?: string | null,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "precos_alterado_por_contato_fkey"
      columns: ["alterado_por_contato"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "precos_alterado_por_contato_fkey"
      columns: ["alterado_por_contato"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "precos_alterado_por_fkey"
      columns: ["alterado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "precos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "precos_grupo_id_cliente_id_fkey"
      columns: ["grupo_id","cliente_id"]
isOneToOne: false
      referencedRelation: "parceiros_grupos"
      referencedColumns: ["id","cliente_id"]
    },{
      foreignKeyName: "precos_produto_id_cliente_id_fkey"
      columns: ["produto_id","cliente_id"]
isOneToOne: false
      referencedRelation: "produtos"
      referencedColumns: ["id","cliente_id"]
    }
                  ]
                },"produtos": {
                  Row: {
                    "apelidos": (string)[],"arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cliente_id": string,"codigo": string,"criado_em": string,"descricao": string,"id": string,"unidade": string
                  }
                  Insert: {
                    "apelidos"?: (string)[],"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cliente_id": string,"codigo": string,"criado_em"?: string,"descricao": string,"id"?: string,"unidade"?: string
                  }
                  Update: {
                    "apelidos"?: (string)[],"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cliente_id"?: string,"codigo"?: string,"criado_em"?: string,"descricao"?: string,"id"?: string,"unidade"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "produtos_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "produtos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"radar_avisos": {
                  Row: {
                    "criado_em": string,"enviado_em": string | null,"giro_id": string | null,"id": string,"mensagem_id": string | null,"novidade_id": string | null,"tipo": string
                  }
                  Insert: {
                    "criado_em"?: string,"enviado_em"?: string | null,"giro_id"?: string | null,"id"?: string,"mensagem_id"?: string | null,"novidade_id"?: string | null,"tipo": string
                  }
                  Update: {
                    "criado_em"?: string,"enviado_em"?: string | null,"giro_id"?: string | null,"id"?: string,"mensagem_id"?: string | null,"novidade_id"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "radar_avisos_giro_id_fkey"
      columns: ["giro_id"]
isOneToOne: false
      referencedRelation: "radar_giros"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_avisos_mensagem_id_fkey"
      columns: ["mensagem_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_avisos_novidade_id_fkey"
      columns: ["novidade_id"]
isOneToOne: false
      referencedRelation: "radar_novidades"
      referencedColumns: ["id"]
    }
                  ]
                },"radar_config": {
                  Row: {
                    "assuntos": (string)[],"atualizado_em": string,"atualizado_por": string | null,"avisar_painel": boolean,"aviso_alto": boolean,"dias": (number)[],"hora": string,"id": number,"limite_usd_giro": number,"resumo_whatsapp": boolean
                  }
                  Insert: {
                    "assuntos"?: (string)[],"atualizado_em"?: string,"atualizado_por"?: string | null,"avisar_painel"?: boolean,"aviso_alto"?: boolean,"dias"?: (number)[],"hora"?: string,"id"?: number,"limite_usd_giro"?: number,"resumo_whatsapp"?: boolean
                  }
                  Update: {
                    "assuntos"?: (string)[],"atualizado_em"?: string,"atualizado_por"?: string | null,"avisar_painel"?: boolean,"aviso_alto"?: boolean,"dias"?: (number)[],"hora"?: string,"id"?: number,"limite_usd_giro"?: number,"resumo_whatsapp"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "radar_config_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"radar_envios": {
                  Row: {
                    "aprovado_em": string,"aprovado_por": string | null,"cliente_id": string,"contato_id": string,"enviado_em": string | null,"estado": string,"id": string,"mensagem_id": string | null,"motivo": string | null,"novidade_id": string,"reservado_em": string | null,"setor_id": string,"texto": string
                  }
                  Insert: {
                    "aprovado_em"?: string,"aprovado_por"?: string | null,"cliente_id": string,"contato_id": string,"enviado_em"?: string | null,"estado"?: string,"id"?: string,"mensagem_id"?: string | null,"motivo"?: string | null,"novidade_id": string,"reservado_em"?: string | null,"setor_id": string,"texto": string
                  }
                  Update: {
                    "aprovado_em"?: string,"aprovado_por"?: string | null,"cliente_id"?: string,"contato_id"?: string,"enviado_em"?: string | null,"estado"?: string,"id"?: string,"mensagem_id"?: string | null,"motivo"?: string | null,"novidade_id"?: string,"reservado_em"?: string | null,"setor_id"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "radar_envios_aprovado_por_fkey"
      columns: ["aprovado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_mensagem_id_fkey"
      columns: ["mensagem_id"]
isOneToOne: false
      referencedRelation: "mensagens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_novidade_id_fkey"
      columns: ["novidade_id"]
isOneToOne: false
      referencedRelation: "radar_novidades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_envios_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"radar_fontes": {
                  Row: {
                    "ativa": boolean,"atualizado_em": string,"caminho": string | null,"criado_em": string,"dominio": string,"etiqueta": string,"id": string,"nome": string,"oficial": boolean,"ordem": number,"paginas": (string)[]
                  }
                  Insert: {
                    "ativa"?: boolean,"atualizado_em"?: string,"caminho"?: string | null,"criado_em"?: string,"dominio": string,"etiqueta"?: string,"id"?: string,"nome": string,"oficial"?: boolean,"ordem"?: number,"paginas"?: (string)[]
                  }
                  Update: {
                    "ativa"?: boolean,"atualizado_em"?: string,"caminho"?: string | null,"criado_em"?: string,"dominio"?: string,"etiqueta"?: string,"id"?: string,"nome"?: string,"oficial"?: boolean,"ordem"?: number,"paginas"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"radar_giros": {
                  Row: {
                    "buscas": number,"criado_em": string,"custo_usd": number,"dia": string,"erro": string | null,"estado": string,"fontes": number,"fontes_fora": NonNullable<Json>,"fontes_ids": (string)[] | null,"id": string,"iniciado_em": string | null,"lidas": NonNullable<Json>,"nova_tentativa_em": string | null,"novidade_id": string | null,"novidades": number,"origem": string,"paginas": number,"pedido_por": string | null,"repetidas": number,"resumo": string | null,"terminado_em": string | null
                  }
                  Insert: {
                    "buscas"?: number,"criado_em"?: string,"custo_usd"?: number,"dia": string,"erro"?: string | null,"estado"?: string,"fontes"?: number,"fontes_fora"?: NonNullable<Json>,"fontes_ids"?: (string)[] | null,"id"?: string,"iniciado_em"?: string | null,"lidas"?: NonNullable<Json>,"nova_tentativa_em"?: string | null,"novidade_id"?: string | null,"novidades"?: number,"origem": string,"paginas"?: number,"pedido_por"?: string | null,"repetidas"?: number,"resumo"?: string | null,"terminado_em"?: string | null
                  }
                  Update: {
                    "buscas"?: number,"criado_em"?: string,"custo_usd"?: number,"dia"?: string,"erro"?: string | null,"estado"?: string,"fontes"?: number,"fontes_fora"?: NonNullable<Json>,"fontes_ids"?: (string)[] | null,"id"?: string,"iniciado_em"?: string | null,"lidas"?: NonNullable<Json>,"nova_tentativa_em"?: string | null,"novidade_id"?: string | null,"novidades"?: number,"origem"?: string,"paginas"?: number,"pedido_por"?: string | null,"repetidas"?: number,"resumo"?: string | null,"terminado_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "radar_giros_novidade_fk"
      columns: ["novidade_id"]
isOneToOne: false
      referencedRelation: "radar_novidades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_giros_pedido_por_fkey"
      columns: ["pedido_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"radar_novidades": {
                  Row: {
                    "achado_em": string,"assunto": string | null,"avisada_em": string | null,"chamado_id": string | null,"clientes_afetados": number,"criterios": NonNullable<Json>,"decidida_em": string | null,"decidida_por": string | null,"estado": string,"fonte_id": string | null,"fonte_nome": string,"giro_id": string | null,"id": string,"impacto": string,"mensagem_cliente": string | null,"publicado_em": string | null,"resumo": string,"selo": string,"setores": (string)[],"titulo": string,"url": string,"url_normalizada": string,"vigencia_inicio": string | null,"vigencia_texto": string | null
                  }
                  Insert: {
                    "achado_em"?: string,"assunto"?: string | null,"avisada_em"?: string | null,"chamado_id"?: string | null,"clientes_afetados"?: number,"criterios"?: NonNullable<Json>,"decidida_em"?: string | null,"decidida_por"?: string | null,"estado"?: string,"fonte_id"?: string | null,"fonte_nome": string,"giro_id"?: string | null,"id"?: string,"impacto": string,"mensagem_cliente"?: string | null,"publicado_em"?: string | null,"resumo": string,"selo": string,"setores"?: (string)[],"titulo": string,"url": string,"url_normalizada": string,"vigencia_inicio"?: string | null,"vigencia_texto"?: string | null
                  }
                  Update: {
                    "achado_em"?: string,"assunto"?: string | null,"avisada_em"?: string | null,"chamado_id"?: string | null,"clientes_afetados"?: number,"criterios"?: NonNullable<Json>,"decidida_em"?: string | null,"decidida_por"?: string | null,"estado"?: string,"fonte_id"?: string | null,"fonte_nome"?: string,"giro_id"?: string | null,"id"?: string,"impacto"?: string,"mensagem_cliente"?: string | null,"publicado_em"?: string | null,"resumo"?: string,"selo"?: string,"setores"?: (string)[],"titulo"?: string,"url"?: string,"url_normalizada"?: string,"vigencia_inicio"?: string | null,"vigencia_texto"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "radar_novidades_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "chamados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_novidades_chamado_id_fkey"
      columns: ["chamado_id"]
isOneToOne: false
      referencedRelation: "demandas_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_novidades_decidida_por_fkey"
      columns: ["decidida_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_novidades_fonte_id_fkey"
      columns: ["fonte_id"]
isOneToOne: false
      referencedRelation: "radar_fontes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "radar_novidades_giro_id_fkey"
      columns: ["giro_id"]
isOneToOne: false
      referencedRelation: "radar_giros"
      referencedColumns: ["id"]
    }
                  ]
                },"respostas_prontas": {
                  Row: {
                    "ativo": boolean,"id": string,"pergunta": string,"resposta": string
                  }
                  Insert: {
                    "ativo"?: boolean,"id"?: string,"pergunta": string,"resposta": string
                  }
                  Update: {
                    "ativo"?: boolean,"id"?: string,"pergunta"?: string,"resposta"?: string
                  }
                  Relationships: [
                    
                  ]
                },"servicos": {
                  Row: {
                    "ativo": boolean,"id": string,"nome": string,"setor_id": string | null
                  }
                  Insert: {
                    "ativo"?: boolean,"id"?: string,"nome": string,"setor_id"?: string | null
                  }
                  Update: {
                    "ativo"?: boolean,"id"?: string,"nome"?: string,"setor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "servicos_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"setores": {
                  Row: {
                    "ativo": boolean,"criado_em": string,"descricao_assuntos": string,"id": string,"nome": string
                  }
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"descricao_assuntos"?: string,"id"?: string,"nome": string
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"descricao_assuntos"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"simulacoes_agente": {
                  Row: {
                    "agente_id": string,"cliente_id": string | null,"criado_em": string,"erro": string | null,"id": string,"mensagem": string,"modo": string | null,"rascunho": Json | null,"respostas": Json | null,"skill_id": string | null,"status": string,"usuario_id": string
                  }
                  Insert: {
                    "agente_id"?: string,"cliente_id"?: string | null,"criado_em"?: string,"erro"?: string | null,"id"?: string,"mensagem": string,"modo"?: string | null,"rascunho"?: Json | null,"respostas"?: Json | null,"skill_id"?: string | null,"status"?: string,"usuario_id": string
                  }
                  Update: {
                    "agente_id"?: string,"cliente_id"?: string | null,"criado_em"?: string,"erro"?: string | null,"id"?: string,"mensagem"?: string,"modo"?: string | null,"rascunho"?: Json | null,"respostas"?: Json | null,"skill_id"?: string | null,"status"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "simulacoes_agente_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "simulacoes_agente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "simulacoes_agente_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "agente_skills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "simulacoes_agente_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"sinais_vida": {
                  Row: {
                    "componente": string,"visto_em": string
                  }
                  Insert: {
                    "componente": string,"visto_em": string
                  }
                  Update: {
                    "componente"?: string,"visto_em"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sugestoes_resposta": {
                  Row: {
                    "concluida_em": string | null,"conversa_id": string,"criado_em": string,"erro": string | null,"id": string,"status": string,"texto": string | null,"usuario_id": string
                  }
                  Insert: {
                    "concluida_em"?: string | null,"conversa_id": string,"criado_em"?: string,"erro"?: string | null,"id"?: string,"status"?: string,"texto"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "concluida_em"?: string | null,"conversa_id"?: string,"criado_em"?: string,"erro"?: string | null,"id"?: string,"status"?: string,"texto"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sugestoes_resposta_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sugestoes_resposta_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "sugestoes_resposta_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sugestoes_resposta_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"tarefas_guarda": {
                  Row: {
                    "atualizado_em": string,"atualizado_por": string | null,"dias": number | null,"id": number
                  }
                  Insert: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"dias"?: number | null,"id"?: number
                  }
                  Update: {
                    "atualizado_em"?: string,"atualizado_por"?: string | null,"dias"?: number | null,"id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tarefas_guarda_atualizado_por_fkey"
      columns: ["atualizado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"travas_trabalhador": {
                  Row: {
                    "ate": string,"chave": string,"dono": string
                  }
                  Insert: {
                    "ate": string,"chave": string,"dono": string
                  }
                  Update: {
                    "ate"?: string,"chave"?: string,"dono"?: string
                  }
                  Relationships: [
                    
                  ]
                },"uso_ia": {
                  Row: {
                    "agente_id": string | null,"cliente_id": string | null,"conversa_id": string | null,"criado_em": string,"custo_usd": number,"funcionalidade": string,"id": string,"modelo": string,"provedor": string,"segundos_audio": number | null,"setor_id": string | null,"tarefa_id": string | null,"tokens_cache_escrita": number,"tokens_cache_leitura": number,"tokens_entrada": number,"tokens_saida": number,"usuario_id": string | null
                  }
                  Insert: {
                    "agente_id"?: string | null,"cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"custo_usd": number,"funcionalidade": string,"id"?: string,"modelo": string,"provedor"?: string,"segundos_audio"?: number | null,"setor_id"?: string | null,"tarefa_id"?: string | null,"tokens_cache_escrita"?: number,"tokens_cache_leitura"?: number,"tokens_entrada": number,"tokens_saida": number,"usuario_id"?: string | null
                  }
                  Update: {
                    "agente_id"?: string | null,"cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"custo_usd"?: number,"funcionalidade"?: string,"id"?: string,"modelo"?: string,"provedor"?: string,"segundos_audio"?: number | null,"setor_id"?: string | null,"tarefa_id"?: string | null,"tokens_cache_escrita"?: number,"tokens_cache_leitura"?: number,"tokens_entrada"?: number,"tokens_saida"?: number,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "uso_ia_agente_id_fkey"
      columns: ["agente_id"]
isOneToOne: false
      referencedRelation: "agentes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "uso_ia_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_tarefa_id_fkey"
      columns: ["tarefa_id"]
isOneToOne: false
      referencedRelation: "agente_tarefas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"usuario_permissoes": {
                  Row: {
                    "modulo": string,"nivel": string,"usuario_id": string
                  }
                  Insert: {
                    "modulo": string,"nivel": string,"usuario_id": string
                  }
                  Update: {
                    "modulo"?: string,"nivel"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_permissoes_modulo_nivel_fkey"
      columns: ["modulo","nivel"]
isOneToOne: false
      referencedRelation: "permissao_niveis"
      referencedColumns: ["modulo","nivel"]
    },{
      foreignKeyName: "usuario_permissoes_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"usuario_setores": {
                  Row: {
                    "setor_id": string,"usuario_id": string
                  }
                  Insert: {
                    "setor_id": string,"usuario_id": string
                  }
                  Update: {
                    "setor_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_setores_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usuario_setores_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"usuarios": {
                  Row: {
                    "arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cargo": string | null,"criado_em": string,"dono": boolean,"email": string,"horario_acesso": Json | null,"id": string,"nome": string,"observacoes": string | null,"papel": Database["public"]['Enums']["papel_usuario"],"permissoes": (string)[],"tamanho_letra": string,"telefone": string | null,"ultimo_acesso_em": string | null,"ver_acessos_portais": boolean,"visao_demandas": string
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"dono"?: boolean,"email": string,"horario_acesso"?: Json | null,"id": string,"nome": string,"observacoes"?: string | null,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"tamanho_letra"?: string,"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"ver_acessos_portais"?: boolean,"visao_demandas"?: string
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"dono"?: boolean,"email"?: string,"horario_acesso"?: Json | null,"id"?: string,"nome"?: string,"observacoes"?: string | null,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"tamanho_letra"?: string,"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"ver_acessos_portais"?: boolean,"visao_demandas"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuarios_arquivado_por_fkey"
      columns: ["arquivado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "caixa_entrada": {
                  Row: {
                    "agente_respondendo": boolean | null,"aguardando_cliente": boolean | null,"aguardando_pessoa_desde": string | null,"atendente_id": string | null,"chamados_abertos": number | null,"cliente_apos_concluir": boolean | null,"cliente_id": string | null,"concluida_em": string | null,"contato_pausado": boolean | null,"empresa": string | null,"empresa_pausada": boolean | null,"espera_desde": string | null,"esperando_pessoa": boolean | null,"esperando_voce": boolean | null,"estado": Database["public"]['Enums']["estado_conversa"] | null,"id": string | null,"motivo_pessoa": string | null,"nao_lidas": number | null,"nome_contato": string | null,"sem_responsavel": boolean | null,"setores_abertos": (string)[] | null,"telefone": string | null,"ultima_autor": Database["public"]['Enums']["autor_mensagem"] | null,"ultima_em": string | null,"ultima_mensagem": string | null,"ultima_tipo": Database["public"]['Enums']["tipo_mensagem"] | null,"ultima_transcricao": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversas_atendente_id_fkey"
      columns: ["atendente_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversas_cliente_em_foco_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    }
                  ]
                },"contatos_lista": {
                  Row: {
                    "agente_pausado": boolean | null,"atendente_id": string | null,"atendente_nome": string | null,"ativo": boolean | null,"conversa_id": string | null,"criado_em": string | null,"empresa_ids": (string)[] | null,"empresas": Json | null,"empresas_busca": string | null,"espera_desde": string | null,"estado_conversa": Database["public"]['Enums']["estado_conversa"] | null,"id": string | null,"muda_preco_alguma": boolean | null,"n_empresas": number | null,"nome": string | null,"pode_pedir_nota_alguma": boolean | null,"telefone": string | null,"ultimo_contato_em": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversas_atendente_id_fkey"
      columns: ["atendente_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    }
                  ]
                },"demandas_lista": {
                  Row: {
                    "atualizado_em": string | null,"cliente_id": string | null,"concluido_em": string | null,"contato": string | null,"contato_id": string | null,"conversa_id": string | null,"criado_em": string | null,"criado_por": string | null,"criado_por_nome": string | null,"empresa": string | null,"fora_do_contrato": boolean | null,"id": string | null,"numero": number | null,"origem": string | null,"pedido_venda": Json | null,"prazo_em": string | null,"prazo_pausado_desde": string | null,"prioridade": Database["public"]['Enums']["prioridade_demanda"] | null,"responsavel": string | null,"responsavel_id": string | null,"resumo": string | null,"setor": string | null,"setor_id": string | null,"status": Database["public"]['Enums']["status_chamado"] | null,"tem_pedido": boolean | null,"titulo": string | null,"vencida": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chamados_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_contato_id_fkey"
      columns: ["contato_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "contatos_lista"
      referencedColumns: ["conversa_id"]
    },{
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_responsavel_id_fkey"
      columns: ["responsavel_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chamados_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "abrir_giros_radar":
{ Args: { "p_agora": string }; Returns: string
                           },
"abrir_pendencia_tarefa":
{ Args: { "p_detalhe": string,"p_mensagem": string,"p_opcoes": (string)[],"p_pergunta": string,"p_tarefa": string,"p_tipo": string }; Returns: number
                           },
"acesso_do_contato":
{ Args: { "p_cliente": string,"p_contato": string }; Returns: Json
                           },
"agente_atendimentos_base":
{ Args: { "p_agente": string,"p_ate": string,"p_de": string }; Returns: {
              "cliente_id": string,"conversa_id": string,"custo_usd": number,"dia": string,"passou_para_pessoa": boolean,"ultima_em": string
            }[]
                           },
"agente_do_uso":
{ Args: { "p_agente": string,"p_funcionalidade": string }; Returns: string
                           },
"agente_numeros_hoje":
{ Args: { "p_agora"?: string }; Returns: Json
                           },
"agentes_checar_numeros":
{ Args: { "p_ate": string,"p_de": string }; Returns: undefined
                           },
"agentes_de_trabalho_da_demanda":
{ Args: { "p_chamado": string }; Returns: {
              "estado": string,"id": string,"nome": string,"pode_pedir": boolean,"procedimentos": Json
            }[]
                           },
"agentes_numeros":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "agente_id": string,"atendimentos": number,"custo_testes_usd": number,"custo_usd": number,"resolvidos": number,"ultima_em": string,"ultima_empresa": string
            }[]
                           },
"agentes_para_contato":
{ Args: { "p_contato": string }; Returns: {
              "estado": string,"ferramentas": (string)[],"id": string,"modelo": string,"modo_contato": string,"nome": string,"regras": Json,"setor": string,"setor_id": string,"slug": string
            }[]
                           },
"agentes_para_pedir":
{ Args: { "p_chamado"?: string }; Returns: {
              "custo_max": number,"custo_min": number,"custo_n": number,"descricao": string,"destino": string,"estado": string,"id": string,"limite_usd": number,"nome": string,"procedimentos": Json,"setor": string,"setor_id": string,"slug": string
            }[]
                           },
"agentes_para_pedir_de":
{ Args: { "p_chamado"?: string,"p_usuario": string }; Returns: {
              "custo_max": number,"custo_min": number,"custo_n": number,"descricao": string,"destino": string,"estado": string,"id": string,"limite_usd": number,"nome": string,"procedimentos": Json,"setor": string,"setor_id": string,"slug": string
            }[]
                           },
"alterar_status_chamado":
{ Args: { "p_chamado": string,"p_status": Database["public"]['Enums']["status_chamado"] }; Returns: undefined
                           },
"alternar_orientacao":
{ Args: { "p_ativo": boolean,"p_id": string }; Returns: boolean
                           },
"alternar_skill":
{ Args: { "p_ativo": boolean,"p_skill": string }; Returns: boolean
                           },
"ambiente_do_banco":
{ Args: { "p_ambiente": string }; Returns: string
                           },
"anonimizar_contato":
{ Args: { "p_contato": string }; Returns: (string)[]
                           },
"anotar_tarefa":
{ Args: { "p_id": string,"p_texto": string }; Returns: undefined
                           },
"aplicar_prazo_abertas":
{ Args: { "p_dias": number,"p_prioridade": Database["public"]['Enums']["prioridade_demanda"] }; Returns: number
                           },
"aprovar_envio_radar":
{ Args: { "p_clientes": (string)[],"p_novidade": string,"p_setor": string,"p_texto": string }; Returns: number
                           },
"aprovar_tarefa":
{ Args: { "p_id": string }; Returns: undefined
                           },
"arquivar_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"arquivar_skill":
{ Args: { "p_skill": string }; Returns: undefined
                           },
"arquivos_da_conversa_para_pendencia":
{ Args: { "p_id": string }; Returns: {
              "criado_em": string,"mensagem_id": string,"mime": string,"nome": string
            }[]
                           },
"arquivos_vencidos_das_tarefas":
{ Args: { "p_limite": number }; Returns: {
              "caminho": string,"id": string
            }[]
                           },
"assumir_conversa":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"assumir_demanda":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"atividade_do_agente":
{ Args: { "p_ate": string,"p_de": string,"p_slug": string }; Returns: {
              "atendimentos": number,"custo_testes_usd": number,"custo_usd": number,"dia": string,"resolvidos": number
            }[]
                           },
"avisar_equipe_radar":
{ Args: { "p_novidade": string }; Returns: number
                           },
"avisar_novidade_nova":
{ Args: { "p_novidade": string }; Returns: Json
                           },
"aviso_login":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"avisos_tarefa_parados":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"cadastrar_contato":
{ Args: { "p_agente_pausado"?: boolean,"p_cliente"?: string,"p_manter"?: (string)[],"p_nome": string,"p_telefone": string }; Returns: Json
                           },
"cadastrar_produto_agente":
{ Args: { "p_apelidos": (string)[],"p_cliente": string,"p_codigo": string,"p_contato": string,"p_descricao": string,"p_unidade": string }; Returns: string
                           },
"calcular_prazo":
{ Args: { "p_inicio"?: string,"p_prioridade": Database["public"]['Enums']["prioridade_demanda"] }; Returns: string
                           },
"calcular_prazo_dias":
{ Args: { "p_dias": number,"p_inicio": string }; Returns: string
                           },
"cargos_validos":
{ Args: { "p": (string)[] }; Returns: boolean
                           },
"casar_eco_saida":
{ Args: { "p_arquivo_nome": string,"p_conversa": string,"p_eh_arquivo"?: boolean,"p_id_provedor": string,"p_texto": string }; Returns: string
                           },
"clientes_afetados_radar":
{ Args: { "p_novidade": string }; Returns: {
              "cidade": string,"cliente_id": string,"nome": string,"regime": string,"uf": string
            }[]
                           },
"concluir_chamado":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"concluir_conversa":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"concluir_etapa_tarefa":
{ Args: { "p_etapa": number,"p_id": string,"p_resumo": string }; Returns: undefined
                           },
"concluir_giro_radar":
{ Args: { "p_dados": Json,"p_giro": string }; Returns: undefined
                           },
"consumir_resumo_nota":
{ Args: { "p_cliente": string,"p_conversa": string,"p_id": string,"p_turno": string }; Returns: Json
                           },
"contato_arquivado_do_telefone":
{ Args: { "p_telefone": string }; Returns: Json
                           },
"contato_ativo_do_telefone":
{ Args: { "p_telefone": string }; Returns: string
                           },
"contato_da_empresa":
{ Args: { "p_cliente": string,"p_contato": string }; Returns: boolean
                           },
"contato_respondeu_pendencias":
{ Args: { "p_contato": string }; Returns: number
                           },
"contato_whatsapp_resumo":
{ Args: { "p_contato": string }; Returns: Json
                           },
"contatos_para_envio_radar":
{ Args: { "p_novidade": string,"p_setor": string }; Returns: {
              "cliente_id": string,"contatos": number,"nome": string
            }[]
                           },
"contatos_para_pendencia":
{ Args: { "p_id": string }; Returns: {
              "contato_id": string,"em_atendimento": boolean,"nome": string
            }[]
                           },
"contatos_procuraveis":
{ Args: { "p_cliente": string,"p_setor": string }; Returns: {
              "contato_id": string,"nome": string,"telefone": string
            }[]
                           },
"continuar_tarefa":
{ Args: { "p_id": string }; Returns: boolean
                           },
"conversas_com_mensagem_parada":
{ Args: { "p_ate_min": number,"p_de_min": number }; Returns: {
              "conversa_id": string,"desde": string,"reenvios": number,"ultimo_reenvio": string
            }[]
                           },
"copiar_endereco_para_logradouro":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"criar_agente":
{ Args: { "p_dados": Json }; Returns: string
                           },
"criar_demanda":
{ Args: { "p_cliente": string,"p_contato"?: string,"p_descricao": string,"p_prazo"?: string,"p_prioridade"?: Database["public"]['Enums']["prioridade_demanda"],"p_responsavel"?: string,"p_setor": string,"p_titulo": string }; Returns: Json
                           } |
{ Args: { "p_cliente": string,"p_contato": string,"p_conversa": string,"p_descricao": string,"p_prazo": string,"p_prioridade": Database["public"]['Enums']["prioridade_demanda"],"p_responsavel": string,"p_setor": string,"p_titulo": string }; Returns: Json
                           },
"criar_demanda_radar":
{ Args: { "p_novidade": string,"p_setor": string }; Returns: Json
                           },
"criar_simulacao":
{ Args: { "p_cliente_id"?: string,"p_mensagem": string,"p_rascunho"?: Json }; Returns: string
                           },
"criar_simulacao_agente":
{ Args: { "p_cliente_id"?: string,"p_mensagem": string,"p_modo"?: string,"p_rascunho"?: Json,"p_skill"?: string,"p_slug": string }; Returns: string
                           },
"criar_simulacao_skill":
{ Args: { "p_cliente_id"?: string,"p_mensagem": string,"p_skill": string }; Returns: string
                           },
"criar_sugestao_agente":
{ Args: { "p_agente": string,"p_chamado": string,"p_conteudo": Json,"p_conversa": string,"p_tipo": string }; Returns: string
                           },
"criar_tarefa_agente":
{ Args: { "p_agente": string,"p_chamado": string,"p_pedido": string,"p_skill"?: string }; Returns: string
                           },
"custo_ia_do_telefone_hoje":
{ Args: { "p_telefone": string }; Returns: number
                           },
"custo_ia_periodo":
{ Args: { "p_fim": string,"p_inicio": string }; Returns: number
                           },
"dados_pagamento_validos":
{ Args: { "p": Json }; Returns: boolean
                           },
"decidir_sugestao":
{ Args: { "p_aprovar": boolean,"p_id": string }; Returns: string
                           },
"definir_contatos_teste":
{ Args: { "p_contatos": (string)[],"p_slug": string }; Returns: undefined
                           },
"definir_etapas_tarefa":
{ Args: { "p_id": string,"p_nomes": (string)[] }; Returns: undefined
                           },
"definir_preco":
{ Args: { "p_grupo": string,"p_produto": string,"p_valor": number }; Returns: string
                           },
"definir_preco_agente":
{ Args: { "p_contato": string,"p_grupo": string,"p_produto": string,"p_valor": number }; Returns: string
                           },
"definir_prioridade_prazo":
{ Args: { "p_chamado": string,"p_prazo"?: string,"p_prioridade"?: Database["public"]['Enums']["prioridade_demanda"] }; Returns: Json
                           },
"definir_responsavel":
{ Args: { "p_chamado": string,"p_responsavel": string }; Returns: undefined
                           },
"definir_tamanho_letra":
{ Args: { "p_tamanho": string }; Returns: undefined
                           },
"definir_ver_acessos":
{ Args: { "p_pode": boolean,"p_usuario": string }; Returns: undefined
                           },
"definir_visao_demandas":
{ Args: { "p_visao": string }; Returns: undefined
                           },
"demanda_para_agir":
{ Args: { "p_aberta"?: boolean,"p_chamado": string }; Returns: {
              "alertado_fila_em": string | null,
"alertado_vencimento_em": string | null,
"atualizado_em": string,
"cliente_id": string | null,
"concluido_em": string | null,
"contato_id": string | null,
"conversa_id": string | null,
"criado_em": string,
"criado_por": string | null,
"fora_do_contrato": boolean,
"id": string,
"numero": number,
"origem": string,
"pedido_venda": Json | null,
"prazo_em": string | null,
"prazo_pausado_desde": string | null,
"prioridade": Database["public"]['Enums']["prioridade_demanda"],
"responsavel_id": string | null,
"resumo": string,
"setor_id": string | null,
"status": Database["public"]['Enums']["status_chamado"],
"titulo": string
            }
                          SetofOptions: {
        from: "*"
        to: "chamados"
        isOneToOne: true
        isSetofReturn: false
      } },
"demandas_para_contato":
{ Args: { "p_cliente": string,"p_contato": string,"p_conversa": string }; Returns: {
              "criado_em": string,"id": string,"numero": number,"setor_id": string,"setor_nome": string,"status": Database["public"]['Enums']["status_chamado"],"titulo": string
            }[]
                           },
"demandas_por_setor":
{ Args: { "p_agora"?: string }; Returns: {
              "abertas": number,"no_prazo": number,"sem_responsavel": number,"setor": string,"setor_id": string,"urgentes": number,"vencem_hoje": number,"vencidas": number
            }[]
                           },
"descartar_novidade_radar":
{ Args: { "p_novidade": string }; Returns: undefined
                           },
"descartar_tarefa":
{ Args: { "p_id": string }; Returns: undefined
                           },
"deslocar_dias_uteis":
{ Args: { "p_dias": number,"p_prazo": string }; Returns: string
                           },
"devolver_ao_agente":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"dia_util_anterior":
{ Args: { "p_dia": string }; Returns: string
                           },
"documentos_para_contato":
{ Args: { "p_cliente": string,"p_contato": string }; Returns: {
              "arquivo_mime": string,"arquivo_nome": string,"arquivo_path": string,"ia_pode_enviar": boolean,"id": string,"nome": string,"setor_id": string,"tem_valores": boolean
            }[]
                           },
"editar_demanda":
{ Args: { "p_chamado": string,"p_contato"?: string,"p_descricao": string,"p_titulo": string }; Returns: undefined
                           },
"eh_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_admin_de":
{ Args: { "p_usuario": string }; Returns: boolean
                           },
"eh_dia_util":
{ Args: { "p_dia": string }; Returns: boolean
                           },
"eh_dono":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_dono_de":
{ Args: { "p_usuario": string }; Returns: boolean
                           },
"eh_telefone_do_assistente":
{ Args: { "p": string }; Returns: boolean
                           },
"eh_usuario_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"encerrar_conducao":
{ Args: { "p_conversa": string,"p_motivo": string }; Returns: boolean
                           },
"entregar_resultado_tarefa":
{ Args: { "p_id": string,"p_resultado": Json }; Returns: undefined
                           },
"envios_da_novidade":
{ Args: { "p_novidade": string }; Returns: {
              "estado": string,"motivo": string,"total": number
            }[]
                           },
"envios_radar_para_enviar":
{ Args: { "p_limite": number }; Returns: string[]
                           },
"estado_sistema_resumo":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"evento_tarefa_agente":
{ Args: { "p_tarefa": string,"p_texto": string }; Returns: undefined
                           },
"excluir_cadastro_definitivo":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"excluir_regra_assunto":
{ Args: { "p_id": string }; Returns: undefined
                           },
"exige_segundo_fator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"exige_segundo_fator_de":
{ Args: { "p_usuario": string }; Returns: boolean
                           },
"exigir_acesso":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"exigir_arquivar":
{ Args: { "p_tipo": string }; Returns: string
                           },
"exigir_segundo_fator":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"ferramentas_do_atendimento":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"ferramentas_do_catalogo":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"ferramentas_do_setor":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"ferramentas_so_do_atendimento":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"finalizar_vez_tarefa":
{ Args: { "p_desde"?: string,"p_id": string,"p_motivo": string,"p_segundos": number }; Returns: string
                           },
"gastos_atendimentos_base":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "chamadas": number,"cliente_id": string,"conversa_id": string,"custo_usd": number,"dia": string,"passou_para_pessoa": boolean
            }[]
                           },
"gastos_atendimentos_do_cliente":
{ Args: { "p_ate": string,"p_cliente": string,"p_de": string }; Returns: {
              "contato": string,"conversa_id": string,"custo_usd": number,"dia": string,"inicio": string,"mensagens": number,"resultado": string
            }[]
                           },
"gastos_chamadas":
{ Args: { "p_ate": string,"p_cliente"?: string,"p_de": string,"p_funcionalidade"?: string,"p_limite"?: number,"p_usuario"?: string }; Returns: {
              "cliente_id": string,"conversa_id": string,"criado_em": string,"custo_usd": number,"empresa": string,"funcionalidade": string,"id": string,"modelo": string,"pessoa": string,"provedor": string,"segundos_audio": number,"tokens_cache_escrita": number,"tokens_cache_leitura": number,"tokens_entrada": number,"tokens_saida": number,"usuario_id": string
            }[]
                           },
"gastos_checar":
{ Args: { "p_ate": string,"p_de": string }; Returns: undefined
                           },
"gastos_dia_mais_caro":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "chamadas": number,"custo": number,"custo_dia": number,"dia": string,"dias_com_gasto": number,"funcionalidade": string,"pessoa": string,"usuario_id": string
            }[]
                           },
"gastos_por_agente":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "agente_id": string,"chamadas": number,"custo_usd": number,"nome": string,"slug": string
            }[]
                           },
"gastos_por_cliente":
{ Args: { "p_ate": string,"p_busca"?: string,"p_de": string }; Returns: {
              "atendimentos": number,"cliente_id": string,"custo_usd": number,"nome": string,"resolvidos": number
            }[]
                           },
"gastos_por_dia":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "chamadas": number,"custo_usd": number,"dia": string
            }[]
                           },
"gastos_por_funcionalidade":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "chamadas": number,"custo_usd": number,"funcionalidade": string
            }[]
                           },
"gastos_por_pessoa":
{ Args: { "p_ate": string,"p_de": string }; Returns: {
              "chamadas": number,"custo_usd": number,"funcionalidade": string,"nome": string,"usuario_id": string
            }[]
                           },
"gastos_resumo":
{ Args: { "p_ate": string,"p_de": string }; Returns: Json
                           },
"gerar_demandas_certificado":
{ Args: { "p_hoje"?: string }; Returns: number
                           },
"horario_permite":
{ Args: { "p_quando"?: string,"p_usuario": string }; Returns: boolean
                           },
"horario_valido":
{ Args: { "h": Json }; Returns: boolean
                           },
"iniciar_conducao":
{ Args: { "p_agente": string,"p_conversa": string }; Returns: boolean
                           },
"iniciar_execucao_tarefa":
{ Args: { "p_id": string }; Returns: string
                           },
"liberar_envio_pendencia":
{ Args: { "p_id": string }; Returns: undefined
                           },
"liberar_envio_radar":
{ Args: { "p_id": string }; Returns: undefined
                           },
"limites_espera":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"marcar_aguardando_pessoa":
{ Args: { "p_conversa": string,"p_motivo": string }; Returns: boolean
                           },
"marcar_alerta_ia80":
{ Args: { "p_mes": string }; Returns: boolean
                           },
"marcar_alerta_lido":
{ Args: { "p_alerta": string }; Returns: undefined
                           },
"marcar_arquivo_lido":
{ Args: { "p_arquivo": string,"p_detalhe": string }; Returns: undefined
                           },
"marcar_arquivos_removidos":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"marcar_aviso_limite_dia":
{ Args: { "p_telefone": string }; Returns: boolean
                           },
"marcar_aviso_radar":
{ Args: { "p_aviso": string,"p_mensagem": string }; Returns: undefined
                           },
"marcar_aviso_tarefa":
{ Args: { "p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"marcar_aviso_unico":
{ Args: { "p_chave": string }; Returns: boolean
                           },
"marcar_conversa_lida":
{ Args: { "p_ate": string,"p_conversa": string }; Returns: boolean
                           },
"marcar_dono_inicial":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"marcar_envio_radar":
{ Args: { "p_id": string,"p_mensagem": string }; Returns: undefined
                           },
"marcar_incertos_antigos":
{ Args: Record<PropertyKey, never>; Returns: {
              "conversa_id": string,"telefone": string
            }[]
                           },
"marcar_pendencia_enviada":
{ Args: { "p_id": string,"p_mensagem": string }; Returns: undefined
                           },
"marcar_pendencias_vistas":
{ Args: { "p_tarefa": string }; Returns: undefined
                           },
"marcar_reenfileirada":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"meu_whatsapp_para_avisos":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"meus_setores":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"montar_endereco":
{ Args: { "p_bairro": string,"p_cep": string,"p_cidade": string,"p_complemento": string,"p_logradouro": string,"p_numero": string,"p_uf": string }; Returns: string
                           },
"mudanca_agente":
{ Args: { "p_agente": string,"p_texto": string }; Returns: undefined
                           },
"niveis_com_padrao":
{ Args: { "p_parcial": Json }; Returns: Json
                           },
"niveis_da_permissao_legada":
{ Args: { "p": (string)[],"p_atual": Json }; Returns: Json
                           },
"niveis_do_usuario":
{ Args: { "p_usuario": string }; Returns: Json
                           },
"nivel_de":
{ Args: { "p_modulo": string,"p_usuario": string }; Returns: string
                           },
"nivel_padrao":
{ Args: { "p_modulo": string }; Returns: string
                           },
"nome_do_eco":
{ Args: { "p": string }; Returns: string
                           },
"nota_interna":
{ Args: { "p_chamado": string,"p_texto": string }; Returns: undefined
                           },
"pasta_drive_da_tarefa":
{ Args: { "p_tarefa": string }; Returns: Json
                           },
"pausar_tarefa":
{ Args: { "p_id": string }; Returns: undefined
                           },
"pedidos_ao_cliente_parados":
{ Args: { "p_minutos": number }; Returns: string[]
                           },
"pedidos_segurados_da_tarefa":
{ Args: { "p_tarefa": string }; Returns: {
              "motivo": string,"pendencia_id": string
            }[]
                           },
"pedir_ajuste_tarefa":
{ Args: { "p_id": string,"p_texto": string }; Returns: boolean
                           },
"pedir_ao_agente":
{ Args: { "p_agente": string,"p_avisar_painel"?: boolean,"p_avisar_whatsapp"?: boolean,"p_chamado"?: string,"p_cliente"?: string,"p_ler_drive"?: boolean,"p_pedido": string,"p_prazo"?: string,"p_skill"?: string,"p_subpasta"?: string }; Returns: Json
                           },
"pedir_ao_agente_de":
{ Args: { "p_agente": string,"p_chamado_numero"?: number,"p_chave"?: string,"p_cliente"?: string,"p_origem": string,"p_pedido": string,"p_prazo"?: string,"p_usuario": string }; Returns: Json
                           },
"pedir_giro_radar":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pedir_leitura_da_pasta":
{ Args: { "p_tarefa": string }; Returns: boolean
                           },
"pedir_pendencia_ao_cliente":
{ Args: { "p_contato": string,"p_id": string,"p_texto": string }; Returns: number
                           },
"pedir_sugestao_resposta":
{ Args: { "p_conversa": string }; Returns: string
                           },
"pegar_giro_radar":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"pegar_lote_do_turno":
{ Args: { "p_conversa": string,"p_ids": (string)[],"p_turno": string }; Returns: Json
                           },
"pegar_trava":
{ Args: { "p_chave": string,"p_dono": string,"p_segundos": number }; Returns: boolean
                           },
"pendencias_pedidas_ao_contato":
{ Args: { "p_contato": string }; Returns: {
              "chamado_numero": number,"empresa": string,"numero": number,"pendencia_id": string,"pergunta": string,"setor": string
            }[]
                           },
"pendencias_repassadas_de":
{ Args: { "p_usuario": string }; Returns: {
              "agente": string,"detalhe": string,"empresa": string,"numero": number,"opcoes": (string)[],"pergunta": string,"tarefa_id": string,"tarefa_numero": number
            }[]
                           },
"perfil_das_marcas":
{ Args: { "p_cliente": string,"p_dados": Json }; Returns: string
                           },
"permissoes_dos_niveis":
{ Args: { "n": Json }; Returns: (string)[]
                           },
"pode_acessar_agora":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pode_mexer_na_tarefa":
{ Args: { "p_tarefa": string }; Returns: boolean
                           },
"pode_ser_responsavel":
{ Args: { "p_setor": string,"p_usuario": string }; Returns: boolean
                           },
"pode_treinar_agente":
{ Args: { "p_agente": string }; Returns: boolean
                           },
"pode_ver_acessos":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pode_ver_agentes":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"pode_ver_chamado":
{ Args: { "p_chamado": string }; Returns: boolean
                           },
"pode_ver_chamado_de":
{ Args: { "p_chamado": string,"p_usuario": string }; Returns: boolean
                           },
"pode_ver_conversa":
{ Args: { "p_conversa": string }; Returns: boolean
                           },
"pode_ver_conversa_de":
{ Args: { "p_conversa": string,"p_usuario": string }; Returns: boolean
                           },
"pode_ver_sugestoes_do_chamado":
{ Args: { "p_chamado": string }; Returns: boolean
                           },
"pode_ver_tarefa":
{ Args: { "p_tarefa": string }; Returns: boolean
                           },
"prazo_segue_regra":
{ Args: { "p_chamado": string }; Returns: boolean
                           },
"prazos_resumo":
{ Args: { "p_inicio"?: string }; Returns: Json
                           },
"procurar_fonte_oficial_radar":
{ Args: { "p_novidade": string }; Returns: string
                           },
"proximo_dia_util":
{ Args: { "p_dia": string }; Returns: string
                           },
"reabrir_demanda":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"receber_pendencia":
{ Args: { "p_arquivo"?: string,"p_id": string,"p_mensagem"?: string,"p_observacao": string }; Returns: boolean
                           },
"reenviar_resposta":
{ Args: { "p_mensagem": string }; Returns: string
                           },
"referencia_da_skill":
{ Args: { "p_agente": string,"p_caminho": string,"p_incluir"?: string,"p_nome": string }; Returns: string
                           },
"registrar_arquivo_drive":
{ Args: { "p_caminho": string,"p_drive_id": string,"p_mime": string,"p_modificado": string,"p_nome": string,"p_tamanho": number,"p_tarefa": string }; Returns: Json
                           },
"registrar_arquivo_tarefa":
{ Args: { "p_caminho": string,"p_mime": string,"p_nome": string,"p_tamanho": number,"p_tarefa": string }; Returns: string
                           },
"registrar_avisos_da_tarefa":
{ Args: { "p_tarefa": string }; Returns: string[]
                           },
"registrar_fator_cadastrado":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"registrar_instancia":
{ Args: { "p_ambiente": string,"p_build_em"?: string,"p_hostname": string,"p_id": string,"p_versao": string }; Returns: Json
                           },
"registrar_novidade_radar":
{ Args: { "p_dados": Json,"p_giro": string }; Returns: Json
                           },
"registrar_pedido_fora_do_acesso":
{ Args: { "p_cliente": string,"p_contato": string,"p_dia": string,"p_setor": string }; Returns: Json
                           },
"registrar_resposta":
{ Args: { "p_arquivo_mime": string,"p_arquivo_nome": string,"p_arquivo_path": string,"p_conversa": string,"p_texto": string }; Returns: string
                           },
"registrar_situacao_drive":
{ Args: { "p_email": string,"p_erro": string,"p_sem_leitor"?: boolean }; Returns: undefined
                           },
"remover_acesso":
{ Args: { "p_id": string }; Returns: undefined
                           },
"remover_fonte_radar":
{ Args: { "p_id": string }; Returns: undefined
                           },
"renovar_trava":
{ Args: { "p_chave": string,"p_dono": string,"p_segundos": number }; Returns: boolean
                           },
"reservar_aviso_tarefa":
{ Args: { "p_id": string }; Returns: Json
                           },
"reservar_envio_pendencia":
{ Args: { "p_id": string }; Returns: {
              "cliente_id": string,"contato_id": string,"contato_nome": string,"id": string,"numero": number,"tarefa_id": string,"telefone": string,"texto": string
            }[]
                           },
"reservar_envio_radar":
{ Args: { "p_id": string }; Returns: {
              "cliente_id": string,"contato_id": string,"id": string,"novidade_id": string,"telefone": string,"texto": string
            }[]
                           },
"reservar_envio_sistema":
{ Args: { "p_max": number }; Returns: boolean
                           },
"reservar_resumo_radar":
{ Args: { "p_giro": string }; Returns: Json
                           },
"responder_pendencia":
{ Args: { "p_id": string,"p_resposta": string }; Returns: boolean
                           },
"responder_pendencia_de":
{ Args: { "p_pendencia": number,"p_resposta": string,"p_tarefa_numero": number,"p_usuario": string }; Returns: Json
                           },
"restaurar_agentes_iniciais":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"restaurar_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"restaurar_orientacao":
{ Args: { "p_versao_id": string }; Returns: string
                           },
"restaurar_radar_inicial":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"restaurar_unidade":
{ Args: { "p_com_rede"?: boolean,"p_id": string }; Returns: Json
                           },
"restaurar_versao_skill":
{ Args: { "p_versao": string }; Returns: number
                           },
"revelar_acesso":
{ Args: { "p_acao"?: string,"p_id": string }; Returns: Json
                           },
"rotulo_agente":
{ Args: { "p_campo": string,"p_valor": string }; Returns: string
                           },
"rotulo_certificado":
{ Args: { "p_tipo": string }; Returns: string
                           },
"salvar_acesso":
{ Args: { "p_cliente": string,"p_id": string,"p_portal": string,"p_senha_cifrada": string,"p_usuario": string }; Returns: string
                           },
"salvar_acesso_contato":
{ Args: { "p_cliente": string,"p_contato": string,"p_dados": Json }; Returns: undefined
                           },
"salvar_agente":
{ Args: { "p_dados": Json,"p_slug": string }; Returns: undefined
                           },
"salvar_config_radar":
{ Args: { "p_dados": Json }; Returns: undefined
                           },
"salvar_dados_pagamento":
{ Args: { "p": Json }; Returns: undefined
                           },
"salvar_ficha_cliente":
{ Args: { "p_dados": Json,"p_id": string }; Returns: string
                           },
"salvar_fonte_radar":
{ Args: { "p_dados": Json,"p_id": string }; Returns: string
                           },
"salvar_guarda_tarefas":
{ Args: { "p_dias": number }; Returns: undefined
                           },
"salvar_limites_tarefa":
{ Args: { "p_minutos": number,"p_slug": string,"p_usd": number }; Returns: undefined
                           },
"salvar_mensagem_radar":
{ Args: { "p_novidade": string,"p_texto": string }; Returns: undefined
                           },
"salvar_orientacao":
{ Args: { "p_ativo"?: boolean,"p_cliente_id"?: string,"p_id": string,"p_setor_id"?: string,"p_texto": string,"p_tipo": string,"p_titulo": string }; Returns: string
                           },
"salvar_orientacao_agente":
{ Args: { "p_ativo"?: boolean,"p_cliente_id"?: string,"p_id": string,"p_setor_id"?: string,"p_slug": string,"p_texto": string,"p_tipo": string,"p_titulo": string }; Returns: string
                           },
"salvar_pasta_drive":
{ Args: { "p_cliente": string,"p_pasta": string }; Returns: string
                           },
"salvar_pre_analise":
{ Args: { "p_agente": string,"p_chamado": string,"p_resultado": Json }; Returns: undefined
                           },
"salvar_regra_assunto":
{ Args: { "p_assunto": string,"p_exemplo": string,"p_id": string,"p_modo": string,"p_slug": string }; Returns: string
                           },
"salvar_responsaveis_cliente":
{ Args: { "p_cliente": string,"p_responsaveis": Json }; Returns: undefined
                           },
"salvar_servicos_cliente":
{ Args: { "p_cliente": string,"p_servicos": (string)[] }; Returns: undefined
                           },
"salvar_usuario":
{ Args: { "p_dados": Json,"p_id": string }; Returns: undefined
                           },
"segundo_fator_ok":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"separar_texto_enviado":
{ Args: { "p_id_provedor": string,"p_mensagem": string,"p_status": string }; Returns: string
                           },
"simular_mudanca_prazo":
{ Args: { "p_dias": number,"p_prioridade": Database["public"]['Enums']["prioridade_demanda"] }; Returns: Json
                           },
"situacao_acesso":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"skills_do_agente":
{ Args: { "p_agente": string,"p_incluir"?: string }; Returns: {
              "arquivos": (string)[],"ativo": boolean,"corpo": string,"descricao": string,"id": string,"nome": string,"tipo": string,"titulo": string,"versao": number
            }[]
                           },
"socios_para_alerta":
{ Args: { "p_cliente": string,"p_exceto": string }; Returns: {
              "contato_id": string,"nome": string,"telefone": string
            }[]
                           },
"soltar_trava":
{ Args: { "p_chave": string,"p_dono": string }; Returns: undefined
                           },
"soltar_travas_do_dono":
{ Args: { "p_donos": (string)[] }; Returns: number
                           },
"somar_custo_giro":
{ Args: { "p_giro": string,"p_usd": number }; Returns: undefined
                           },
"somar_custo_tarefa":
{ Args: { "p_custo": number,"p_id": string }; Returns: undefined
                           },
"somar_tempo_util":
{ Args: { "p_de": string,"p_tempo": string }; Returns: string
                           },
"subir_skill":
{ Args: { "p_pacote": Json,"p_slug": string }; Returns: Json
                           },
"tabela_do_cadastro":
{ Args: { "p_tipo": string }; Returns: string
                           },
"tarefa_do_caminho":
{ Args: { "p_nome": string }; Returns: string
                           },
"tarefas_paradas":
{ Args: { "p_minutos": number }; Returns: string[]
                           },
"telefone_canonico":
{ Args: { "p": string }; Returns: string
                           },
"tem_nivel":
{ Args: { "p_minimo": string,"p_modulo": string }; Returns: boolean
                           },
"tem_nivel_de":
{ Args: { "p_minimo": string,"p_modulo": string,"p_usuario": string }; Returns: boolean
                           },
"tem_permissao":
{ Args: { "p": string }; Returns: boolean
                           } |
{ Args: { "p_minimo": string,"p_modulo": string }; Returns: boolean
                           },
"tempo_util_entre":
{ Args: { "p_ate": string,"p_de": string }; Returns: string
                           },
"texto_da_ficha":
{ Args: { "k": string,"p": Json }; Returns: string
                           },
"texto_do_eco":
{ Args: { "p": string }; Returns: string
                           },
"texto_prazo":
{ Args: { "p": string }; Returns: string
                           },
"transferir_chamado":
{ Args: { "p_chamado": string,"p_responsavel": string,"p_setor": string }; Returns: undefined
                           },
"trocar_empresa_conversa":
{ Args: { "p_cliente": string,"p_conversa": string }; Returns: Json
                           },
"ultima_alteracao_cliente":
{ Args: { "p_cliente": string }; Returns: Json
                           },
"usar_confirmacao":
{ Args: { "p_contato": string,"p_conversa": string,"p_id": string,"p_turno": string }; Returns: Json
                           },
"uso_do_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: Json
                           },
"uso_ia_classificacao":
{ Args: { "p_conversa": string,"p_quando": string }; Returns: {
              "cliente_id": string,"funcionalidade": string
            }[]
                           },
"uso_regras":
{ Args: { "p_ate": string,"p_de": string,"p_slug": string }; Returns: {
              "conversas": number,"regra_id": string
            }[]
                           },
"uso_skills":
{ Args: { "p_ate": string,"p_de": string,"p_slug": string }; Returns: {
              "nome": string,"vezes": number
            }[]
                           },
"usuario_liberado":
{ Args: { "p_usuario": string }; Returns: boolean
                           },
"vincular_contato_conversa":
{ Args: { "p_contato": string,"p_conversa": string }; Returns: undefined
                           }
          }
          Enums: {
            "autor_mensagem": "cliente"|"agente"|"atendente"|"sistema","direcao_mensagem": "entrada"|"saida","estado_conversa": "agente"|"humano","papel_usuario": "admin"|"atendente","prioridade_demanda": "baixa"|"normal"|"alta"|"urgente","status_chamado": "aberto"|"em_andamento"|"aguardando_cliente"|"concluido","status_envio": "pendente"|"enviada"|"falhou"|"incerto","tipo_mensagem": "texto"|"audio"|"imagem"|"documento","tipo_parceiro": "cliente"|"fornecedor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "autor_mensagem": ["cliente", "agente", "atendente", "sistema"],"direcao_mensagem": ["entrada", "saida"],"estado_conversa": ["agente", "humano"],"papel_usuario": ["admin", "atendente"],"prioridade_demanda": ["baixa", "normal", "alta", "urgente"],"status_chamado": ["aberto", "em_andamento", "aguardando_cliente", "concluido"],"status_envio": ["pendente", "enviada", "falhou", "incerto"],"tipo_mensagem": ["texto", "audio", "imagem", "documento"],"tipo_parceiro": ["cliente", "fornecedor"]
          }
        }
} as const

