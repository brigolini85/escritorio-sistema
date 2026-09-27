
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
                    "criado_em": string,"id": string,"lido_em": string | null,"mensagem": string,"nivel": string,"setor_id": string | null
                  }
                  Insert: {
                    "criado_em"?: string,"id"?: string,"lido_em"?: string | null,"mensagem": string,"nivel": string,"setor_id"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"lido_em"?: string | null,"mensagem"?: string,"nivel"?: string,"setor_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alertas_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
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
                    "alertado_fila_em": string | null,"atualizado_em": string,"cliente_id": string | null,"concluido_em": string | null,"conversa_id": string | null,"criado_em": string,"fora_do_contrato": boolean,"id": string,"numero": number,"origem": string,"responsavel_id": string | null,"resumo": string,"setor_id": string | null,"status": Database["public"]['Enums']["status_chamado"],"titulo": string
                  }
                  Insert: {
                    "alertado_fila_em"?: string | null,"atualizado_em"?: string,"cliente_id"?: string | null,"concluido_em"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"fora_do_contrato"?: boolean,"id"?: string,"numero"?: never,"origem"?: string,"responsavel_id"?: string | null,"resumo"?: string,"setor_id"?: string | null,"status"?: Database["public"]['Enums']["status_chamado"],"titulo": string
                  }
                  Update: {
                    "alertado_fila_em"?: string | null,"atualizado_em"?: string,"cliente_id"?: string | null,"concluido_em"?: string | null,"conversa_id"?: string | null,"criado_em"?: string,"fora_do_contrato"?: boolean,"id"?: string,"numero"?: never,"origem"?: string,"responsavel_id"?: string | null,"resumo"?: string,"setor_id"?: string | null,"status"?: Database["public"]['Enums']["status_chamado"],"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chamados_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
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
                    "agente_pausado": boolean,"ativo": boolean,"cnpj": string,"criado_em": string,"endereco": string | null,"id": string,"inscricao_estadual": string | null,"nome_fantasia": string | null,"razao_social": string,"regime": string | null,"uf": string | null
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"ativo"?: boolean,"cnpj": string,"criado_em"?: string,"endereco"?: string | null,"id"?: string,"inscricao_estadual"?: string | null,"nome_fantasia"?: string | null,"razao_social": string,"regime"?: string | null,"uf"?: string | null
                  }
                  Update: {
                    "agente_pausado"?: boolean,"ativo"?: boolean,"cnpj"?: string,"criado_em"?: string,"endereco"?: string | null,"id"?: string,"inscricao_estadual"?: string | null,"nome_fantasia"?: string | null,"razao_social"?: string,"regime"?: string | null,"uf"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"configuracoes": {
                  Row: {
                    "agente_pausado": boolean,"alerta_ia_80_mes": string | null,"dias_uteis": (number)[],"email_alertas": string | null,"horario_fim": string,"horario_inicio": string,"id": number,"mensagens": NonNullable<Json>,"minutos_alerta_fila": number,"modelo_conversa": string,"modelo_rapido": string,"precos_modelos": NonNullable<Json>,"telefone_dono": string | null,"teto_ia_usd": number
                  }
                  Insert: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
                  }
                  Update: {
                    "agente_pausado"?: boolean,"alerta_ia_80_mes"?: string | null,"dias_uteis"?: (number)[],"email_alertas"?: string | null,"horario_fim"?: string,"horario_inicio"?: string,"id"?: number,"mensagens"?: NonNullable<Json>,"minutos_alerta_fila"?: number,"modelo_conversa"?: string,"modelo_rapido"?: string,"precos_modelos"?: NonNullable<Json>,"telefone_dono"?: string | null,"teto_ia_usd"?: number
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
                    "ativo": boolean,"criado_em": string,"id": string,"nome": string,"telefone": string
                  }
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"id"?: string,"nome": string,"telefone": string
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"id"?: string,"nome"?: string,"telefone"?: string
                  }
                  Relationships: [
                    
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
      referencedRelation: "conversas"
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
                    "arquivo_mime": string | null,"arquivo_nome": string | null,"arquivo_path": string | null,"atendente_id": string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id": string | null,"conteudo": string | null,"conversa_id": string,"criado_em": string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"id": string,"id_provedor": string | null,"midia_url_origem": string | null,"processada_em": string | null,"status_envio": Database["public"]['Enums']["status_envio"] | null,"tipo": Database["public"]['Enums']["tipo_mensagem"],"transcricao": string | null
                  }
                  Insert: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor": Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id": string,"criado_em"?: string,"direcao": Database["public"]['Enums']["direcao_mensagem"],"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null
                  }
                  Update: {
                    "arquivo_mime"?: string | null,"arquivo_nome"?: string | null,"arquivo_path"?: string | null,"atendente_id"?: string | null,"autor"?: Database["public"]['Enums']["autor_mensagem"],"cliente_id"?: string | null,"conteudo"?: string | null,"conversa_id"?: string,"criado_em"?: string,"direcao"?: Database["public"]['Enums']["direcao_mensagem"],"id"?: string,"id_provedor"?: string | null,"midia_url_origem"?: string | null,"processada_em"?: string | null,"status_envio"?: Database["public"]['Enums']["status_envio"] | null,"tipo"?: Database["public"]['Enums']["tipo_mensagem"],"transcricao"?: string | null
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
      referencedRelation: "conversas"
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
      referencedRelation: "conversas"
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
                    "ativo": boolean,"criado_em": string,"email": string,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel_usuario"],"permissoes": (string)[],"telefone": string | null
                  }
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"email": string,"id": string,"nome": string,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"telefone"?: string | null
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"email"?: string,"id"?: string,"nome"?: string,"papel"?: Database["public"]['Enums']["papel_usuario"],"permissoes"?: (string)[],"telefone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assumir_conversa":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"concluir_chamado":
{ Args: { "p_chamado": string }; Returns: undefined
                           },
"devolver_ao_agente":
{ Args: { "p_conversa": string }; Returns: undefined
                           },
"eh_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"eh_usuario_ativo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"marcar_alerta_lido":
{ Args: { "p_alerta": string }; Returns: undefined
                           },
"meus_setores":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"nota_interna":
{ Args: { "p_chamado": string,"p_texto": string }; Returns: undefined
                           },
"pode_ver_chamado":
{ Args: { "p_chamado": string }; Returns: boolean
                           },
"pode_ver_conversa":
{ Args: { "p_conversa": string }; Returns: boolean
                           },
"registrar_resposta":
{ Args: { "p_arquivo_mime": string,"p_arquivo_nome": string,"p_arquivo_path": string,"p_conversa": string,"p_texto": string }; Returns: string
                           },
"tem_permissao":
{ Args: { "p": string }; Returns: boolean
                           },
"transferir_chamado":
{ Args: { "p_chamado": string,"p_responsavel": string,"p_setor": string }; Returns: undefined
                           }
          }
          Enums: {
            "autor_mensagem": "cliente"|"agente"|"atendente"|"sistema","direcao_mensagem": "entrada"|"saida","estado_conversa": "agente"|"humano","papel_usuario": "admin"|"atendente","status_chamado": "aberto"|"em_andamento"|"aguardando_cliente"|"concluido","status_envio": "pendente"|"enviada"|"falhou","tipo_mensagem": "texto"|"audio"|"imagem"|"documento"
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
            "autor_mensagem": ["cliente", "agente", "atendente", "sistema"],"direcao_mensagem": ["entrada", "saida"],"estado_conversa": ["agente", "humano"],"papel_usuario": ["admin", "atendente"],"status_chamado": ["aberto", "em_andamento", "aguardando_cliente", "concluido"],"status_envio": ["pendente", "enviada", "falhou"],"tipo_mensagem": ["texto", "audio", "imagem", "documento"]
          }
        }
} as const

