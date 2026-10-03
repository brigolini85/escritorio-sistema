
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
            "alertas": {
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
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
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
                    "agente_pausado": boolean,"arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cnpj": string,"criado_em": string,"endereco": string | null,"id": string,"inscricao_estadual": string | null,"nome_fantasia": string | null,"razao_social": string,"regime": string | null,"uf": string | null
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cnpj": string,"criado_em"?: string,"endereco"?: string | null,"id"?: string,"inscricao_estadual"?: string | null,"nome_fantasia"?: string | null,"razao_social": string,"regime"?: string | null,"uf"?: string | null
                  }
                  Update: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cnpj"?: string,"criado_em"?: string,"endereco"?: string | null,"id"?: string,"inscricao_estadual"?: string | null,"nome_fantasia"?: string | null,"razao_social"?: string,"regime"?: string | null,"uf"?: string | null
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
                    "agente_pausado": boolean,"alerta_ia_80_mes": string | null,"aviso_login": string,"dias_uteis": (number)[],"email_alertas": string | null,"horario_fim": string,"horario_inicio": string,"id": number,"mensagens": NonNullable<Json>,"minutos_alerta_fila": number,"modelo_conversa": string,"modelo_rapido": string,"prazo_alta_dias": number,"prazo_baixa_dias": number,"prazo_normal_dias": number,"prazo_urgente_dias": number,"precos_modelos": NonNullable<Json>,"telefone_dono": string | null,"teto_ia_usd": number
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"aviso_login"?: string,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"prazo_alta_dias"?: number,"prazo_baixa_dias"?: number,"prazo_normal_dias"?: number,"prazo_urgente_dias"?: number,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
                  }
                  Update: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"aviso_login"?: string,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"prazo_alta_dias"?: number,"prazo_baixa_dias"?: number,"prazo_normal_dias"?: number,"prazo_urgente_dias"?: number,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
                  }
                  Relationships: [
                    
                  ]
                },"contato_clientes": {
                  Row: {
                    "cliente_id": string,"contato_id": string,"pode_atualizar_preco": boolean,"pode_pedir_nota": boolean
                  }
                  Insert: {
                    "cliente_id": string,"contato_id": string,"pode_atualizar_preco"?: boolean,"pode_pedir_nota"?: boolean
                  }
                  Update: {
                    "cliente_id"?: string,"contato_id"?: string,"pode_atualizar_preco"?: boolean,"pode_pedir_nota"?: boolean
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
    }
                  ]
                },"contatos": {
                  Row: {
                    "agente_pausado": boolean,"arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"criado_em": string,"id": string,"nome": string,"telefone": string
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"criado_em"?: string,"id"?: string,"nome": string,"telefone": string
                  }
                  Update: {
                    "agente_pausado"?: boolean,"arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"criado_em"?: string,"id"?: string,"nome"?: string,"telefone"?: string
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
                },"conversas": {
                  Row: {
                    "atendente_id": string | null,"atualizado_em": string,"aviso_lgpd_enviado_em": string | null,"cliente_em_foco": string | null,"contato_id": string | null,"criado_em": string,"estado": Database["public"]['Enums']["estado_conversa"],"id": string,"telefone": string,"tentativas_nao_entendido": number
                  }
                  Insert: {
                    "atendente_id"?: string | null,"atualizado_em"?: string,"aviso_lgpd_enviado_em"?: string | null,"cliente_em_foco"?: string | null,"contato_id"?: string | null,"criado_em"?: string,"estado"?: Database["public"]['Enums']["estado_conversa"],"id"?: string,"telefone": string,"tentativas_nao_entendido"?: number
                  }
                  Update: {
                    "atendente_id"?: string | null,"atualizado_em"?: string,"aviso_lgpd_enviado_em"?: string | null,"cliente_em_foco"?: string | null,"contato_id"?: string | null,"criado_em"?: string,"estado"?: Database["public"]['Enums']["estado_conversa"],"id"?: string,"telefone"?: string,"tentativas_nao_entendido"?: number
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
    }
                  ]
                },"decisoes_agente": {
                  Row: {
                    "cliente_id": string | null,"conversa_id": string | null,"criado_em": string,"entrada": Json | null,"etapa": string,"id": string,"justificativa": string | null,"saida": Json | null
                  }
                  Insert: {
                    "cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"entrada"?: Json | null,"etapa": string,"id"?: string,"justificativa"?: string | null,"saida"?: Json | null
                  }
                  Update: {
                    "cliente_id"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"entrada"?: Json | null,"etapa"?: string,"id"?: string,"justificativa"?: string | null,"saida"?: Json | null
                  }
                  Relationships: [
                    {
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
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos_empresa": {
                  Row: {
                    "arquivo_mime": string,"arquivo_nome": string,"arquivo_path": string,"cliente_id": string,"criado_em": string,"enviado_por": string | null,"ia_pode_enviar": boolean,"id": string,"nome": string
                  }
                  Insert: {
                    "arquivo_mime"?: string,"arquivo_nome": string,"arquivo_path": string,"cliente_id": string,"criado_em"?: string,"enviado_por"?: string | null,"ia_pode_enviar"?: boolean,"id"?: string,"nome": string
                  }
                  Update: {
                    "arquivo_mime"?: string,"arquivo_nome"?: string,"arquivo_path"?: string,"cliente_id"?: string,"criado_em"?: string,"enviado_por"?: string | null,"ia_pode_enviar"?: boolean,"id"?: string,"nome"?: string
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
    }
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
                },"mensagens": {
                  Row: {
                    "arquivo_mime": string | null,"arquivo_nome": string | null,"arquivo_path": string | null,"atendente_id": string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id": string | null,"conteudo": string | null,"conversa_id": string,"criado_em": string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"envio_reservado_em": string | null,"id": string,"id_provedor": string | null,"midia_url_origem": string | null,"processada_em": string | null,"status_envio": Database["public"]['Enums']["status_envio"] | null,"tipo": Database["public"]['Enums']["tipo_mensagem"],"transcricao": string | null
                  }
                  Insert: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id": string,"criado_em"?: string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"envio_reservado_em"?: string | null,"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null
                  }
                  Update: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor"?: Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id"?: string,"criado_em"?: string,"direcao"?: Database["public"]['Enums']["direcao_mensagem"],"envio_reservado_em"?: string | null,"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null
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
      referencedRelation: "conversas"
      referencedColumns: ["id"]
    }
                  ]
                },"orientacoes_agente": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"atualizado_por": string | null,"cliente_id": string | null,"criado_em": string,"criado_por": string | null,"id": string,"setor_id": string | null,"texto": string,"tipo": string,"titulo": string
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"setor_id"?: string | null,"texto": string,"tipo": string,"titulo": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"atualizado_por"?: string | null,"cliente_id"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"id"?: string,"setor_id"?: string | null,"texto"?: string,"tipo"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
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
                    "cliente_id": string | null,"criado_em": string,"erro": string | null,"id": string,"mensagem": string,"rascunho": Json | null,"respostas": Json | null,"status": string,"usuario_id": string
                  }
                  Insert: {
                    "cliente_id"?: string | null,"criado_em"?: string,"erro"?: string | null,"id"?: string,"mensagem": string,"rascunho"?: Json | null,"respostas"?: Json | null,"status"?: string,"usuario_id": string
                  }
                  Update: {
                    "cliente_id"?: string | null,"criado_em"?: string,"erro"?: string | null,"id"?: string,"mensagem"?: string,"rascunho"?: Json | null,"respostas"?: Json | null,"status"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "simulacoes_agente_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
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
                },"uso_ia": {
                  Row: {
                    "conversa_id": string | null,"criado_em": string,"custo_usd": number,"id": string,"modelo": string,"tokens_cache_escrita": number,"tokens_cache_leitura": number,"tokens_entrada": number,"tokens_saida": number
                  }
                  Insert: {
                    "conversa_id"?: string | null,"criado_em"?: string,"custo_usd": number,"id"?: string,"modelo": string,"tokens_cache_escrita"?: number,"tokens_cache_leitura"?: number,"tokens_entrada": number,"tokens_saida": number
                  }
                  Update: {
                    "conversa_id"?: string | null,"criado_em"?: string,"custo_usd"?: number,"id"?: string,"modelo"?: string,"tokens_cache_escrita"?: number,"tokens_cache_leitura"?: number,"tokens_entrada"?: number,"tokens_saida"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "uso_ia_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uso_ia_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "conversas"
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
                    "arquivado_em": string | null,"arquivado_por": string | null,"ativo": boolean,"cargo": string | null,"criado_em": string,"email": string,"id": string,"nome": string,"observacoes": string | null,"papel": Database["public"]['Enums']["papel_usuario"],"permissoes": (string)[],"tamanho_letra": string,"telefone": string | null,"ultimo_acesso_em": string | null,"visao_demandas": string
                  }
                  Insert: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"email": string,"id": string,"nome": string,"observacoes"?: string | null,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"tamanho_letra"?: string,"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"visao_demandas"?: string
                  }
                  Update: {
                    "arquivado_em"?: string | null,"arquivado_por"?: string | null,"ativo"?: boolean,"cargo"?: string | null,"criado_em"?: string,"email"?: string,"id"?: string,"nome"?: string,"observacoes"?: string | null,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"tamanho_letra"?: string,"telefone"?: string | null,"ultimo_acesso_em"?: string | null,"visao_demandas"?: string
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
                    "aguardando_cliente": boolean | null,"atendente_id": string | null,"chamados_abertos": number | null,"empresa": string | null,"estado": Database["public"]['Enums']["estado_conversa"] | null,"id": string | null,"nome_contato": string | null,"sem_responsavel": boolean | null,"setores_abertos": (string)[] | null,"telefone": string | null,"ultima_em": string | null,"ultima_mensagem": string | null
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
      foreignKeyName: "chamados_conversa_id_fkey"
      columns: ["conversa_id"]
isOneToOne: false
      referencedRelation: "caixa_entrada"
      referencedColumns: ["id"]
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
            "alterar_status_chamado":
{ Args: { "p_chamado": string,"p_status": Database["public"]['Enums']["status_chamado"] }; Returns: undefined
                           },
"alternar_orientacao":
{ Args: { "p_ativo": boolean,"p_id": string }; Returns: boolean
                           },
"anonimizar_contato":
{ Args: { "p_contato": string }; Returns: (string)[]
                           },
"arquivar_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"assumir_conversa":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"assumir_demanda":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"aviso_login":
{ Args: Record<PropertyKey, never>; Returns: string
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
"concluir_chamado":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"contato_arquivado_do_telefone":
{ Args: { "p_telefone": string }; Returns: Json
                           },
"contato_da_empresa":
{ Args: { "p_cliente": string,"p_contato": string }; Returns: boolean
                           },
"criar_demanda":
{ Args: { "p_cliente": string,"p_contato"?: string,"p_descricao": string,"p_prazo"?: string,"p_prioridade"?: Database["public"]['Enums']["prioridade_demanda"],"p_responsavel"?: string,"p_setor": string,"p_titulo": string }; Returns: Json
                           },
"criar_simulacao":
{ Args: { "p_cliente_id"?: string,"p_mensagem": string,"p_rascunho"?: Json }; Returns: string
                           },
"custo_ia_periodo":
{ Args: { "p_fim": string,"p_inicio": string }; Returns: number
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
"devolver_ao_agente":
{ Args: { "p_conversa": string }; Returns: undefined
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
"eh_telefone_do_assistente":
{ Args: { "p": string }; Returns: boolean
                           },
"eh_usuario_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"excluir_cadastro_definitivo":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"exigir_arquivar":
{ Args: { "p_tipo": string }; Returns: string
                           },
"marcar_alerta_lido":
{ Args: { "p_alerta": string }; Returns: undefined
                           },
"meus_setores":
{ Args: Record<PropertyKey, never>; Returns: string[]
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
"nota_interna":
{ Args: { "p_chamado": string,"p_texto": string }; Returns: undefined
                           },
"permissoes_dos_niveis":
{ Args: { "n": Json }; Returns: (string)[]
                           },
"pode_ser_responsavel":
{ Args: { "p_setor": string,"p_usuario": string }; Returns: boolean
                           },
"pode_ver_chamado":
{ Args: { "p_chamado": string }; Returns: boolean
                           },
"pode_ver_conversa":
{ Args: { "p_conversa": string }; Returns: boolean
                           },
"proximo_dia_util":
{ Args: { "p_dia": string }; Returns: string
                           },
"reabrir_demanda":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"registrar_resposta":
{ Args: { "p_arquivo_mime": string,"p_arquivo_nome": string,"p_arquivo_path": string,"p_conversa": string,"p_texto": string }; Returns: string
                           },
"restaurar_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: undefined
                           },
"restaurar_orientacao":
{ Args: { "p_versao_id": string }; Returns: string
                           },
"restaurar_unidade":
{ Args: { "p_com_rede"?: boolean,"p_id": string }; Returns: Json
                           },
"salvar_orientacao":
{ Args: { "p_ativo"?: boolean,"p_cliente_id"?: string,"p_id": string,"p_setor_id"?: string,"p_texto": string,"p_tipo": string,"p_titulo": string }; Returns: string
                           },
"somar_tempo_util":
{ Args: { "p_de": string,"p_tempo": string }; Returns: string
                           },
"tabela_do_cadastro":
{ Args: { "p_tipo": string }; Returns: string
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
"texto_prazo":
{ Args: { "p": string }; Returns: string
                           },
"transferir_chamado":
{ Args: { "p_chamado": string,"p_responsavel": string,"p_setor": string }; Returns: undefined
                           },
"uso_do_cadastro":
{ Args: { "p_id": string,"p_tipo": string }; Returns: Json
                           },
"usuario_liberado":
{ Args: { "p_usuario": string }; Returns: boolean
                           },
"vincular_contato_conversa":
{ Args: { "p_contato": string,"p_conversa": string }; Returns: undefined
                           }
          }
          Enums: {
            "autor_mensagem": "cliente"|"agente"|"atendente"|"sistema","direcao_mensagem": "entrada"|"saida","estado_conversa": "agente"|"humano","papel_usuario": "admin"|"atendente","prioridade_demanda": "baixa"|"normal"|"alta"|"urgente","status_chamado": "aberto"|"em_andamento"|"aguardando_cliente"|"concluido","status_envio": "pendente"|"enviada"|"falhou","tipo_mensagem": "texto"|"audio"|"imagem"|"documento","tipo_parceiro": "cliente"|"fornecedor"
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
            "autor_mensagem": ["cliente", "agente", "atendente", "sistema"],"direcao_mensagem": ["entrada", "saida"],"estado_conversa": ["agente", "humano"],"papel_usuario": ["admin", "atendente"],"prioridade_demanda": ["baixa", "normal", "alta", "urgente"],"status_chamado": ["aberto", "em_andamento", "aguardando_cliente", "concluido"],"status_envio": ["pendente", "enviada", "falhou"],"tipo_mensagem": ["texto", "audio", "imagem", "documento"],"tipo_parceiro": ["cliente", "fornecedor"]
          }
        }
} as const

