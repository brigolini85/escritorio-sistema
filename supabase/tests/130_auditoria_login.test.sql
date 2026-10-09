-- Auditoria 2.3: limite de tentativas de login, "esqueci a senha" e código do segundo fator, contado no banco (vale
-- entre processos do painel). Só o painel com a chave de serviço conta; a pessoa logada e o visitante não.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- 1–6: permissões
select has_table('public', 'tentativas_login', 'a tabela de tentativas existe');
select ok(not has_function_privilege('anon', 'public.contar_tentativa(text, integer, integer)', 'execute'), 'visitante não conta tentativa');
select ok(not has_function_privilege('authenticated', 'public.contar_tentativa(text, integer, integer)', 'execute'), 'pessoa logada não conta tentativa');
select ok(has_function_privilege('service_role', 'public.contar_tentativa(text, integer, integer)', 'execute'), 'o painel (serviço) conta');
select ok(not has_table_privilege('authenticated', 'public.tentativas_login', 'select'), 'pessoa logada não lê as tentativas');
select ok(not has_table_privilege('anon', 'public.tentativas_login', 'delete'), 'visitante não apaga as tentativas');

-- 7–11: até o limite passa; a seguinte é recusada (5 por minuto)
select ok(public.contar_tentativa('ip-min:pgtap-a', 5, 60), '1ª tentativa passa');
select ok(public.contar_tentativa('ip-min:pgtap-a', 5, 60) and public.contar_tentativa('ip-min:pgtap-a', 5, 60)
  and public.contar_tentativa('ip-min:pgtap-a', 5, 60), '2ª a 4ª passam');
select ok(public.contar_tentativa('ip-min:pgtap-a', 5, 60), '5ª tentativa passa');
select ok(not public.contar_tentativa('ip-min:pgtap-a', 5, 60), '6ª tentativa no mesmo minuto é recusada');
select ok(not public.contar_tentativa('ip-min:pgtap-a', 5, 60), 'continua recusada (o total não passa do limite)');

-- 12: outra chave não é afetada
select ok(public.contar_tentativa('ip-min:pgtap-b', 5, 60), 'outro IP continua passando');

-- 13: a janela vencida não conta (linha antiga de outro minuto)
delete from public.tentativas_login where chave = 'ip-min:pgtap-c';
insert into public.tentativas_login (chave, janela, total) values ('ip-min:pgtap-c', now() - interval '2 minutes', 99);
select ok(public.contar_tentativa('ip-min:pgtap-c', 5, 60), 'janela vencida não conta');

-- 14: limpeza das janelas de mais de um dia
insert into public.tentativas_login (chave, janela, total) values ('ip-min:pgtap-velha', now() - interval '2 days', 3);
select public.contar_tentativa('ip-min:pgtap-d', 5, 60);
select is((select count(*)::int from public.tentativas_login where chave = 'ip-min:pgtap-velha'), 0, 'janelas de mais de um dia saem');

-- 15–16: parâmetros inválidos
select throws_ok($$ select public.contar_tentativa('x', 0, 60) $$, '22023', null, 'limite zero é recusado');
select throws_ok($$ select public.contar_tentativa('', 5, 60) $$, '22023', null, 'chave vazia é recusada');

-- 17–23: revisão (auditoria 2.3): login certo devolve a tentativa; só o serviço devolve
select ok(not has_function_privilege('anon', 'public.devolver_tentativa(text, integer)', 'execute'), 'visitante não devolve tentativa');
select ok(not has_function_privilege('authenticated', 'public.devolver_tentativa(text, integer)', 'execute'), 'pessoa logada não devolve tentativa');
select ok(has_function_privilege('service_role', 'public.devolver_tentativa(text, integer)', 'execute'), 'o painel (serviço) devolve');
select public.contar_tentativa('ip-min:pgtap-e', 2, 60);
select public.contar_tentativa('ip-min:pgtap-e', 2, 60);
select ok(not public.contar_tentativa('ip-min:pgtap-e', 2, 60), 'cheio: a próxima é recusada');
select public.devolver_tentativa('ip-min:pgtap-e', 60);
select is((select total from public.tentativas_login where chave = 'ip-min:pgtap-e'), 1, 'a devolução tira uma da janela atual');
select ok(public.contar_tentativa('ip-min:pgtap-e', 2, 60), 'depois da devolução, cabe mais uma');
select public.devolver_tentativa('ip-min:pgtap-f', 60);
select public.devolver_tentativa('ip-min:pgtap-e', 60);
select public.devolver_tentativa('ip-min:pgtap-e', 60);
select public.devolver_tentativa('ip-min:pgtap-e', 60);
select is((select total from public.tentativas_login where chave = 'ip-min:pgtap-e'), 0, 'nunca fica negativo (e chave sem linha não dá erro)');

select * from finish();
rollback;
