# Integração do header compartilhado SIA

Este documento descreve a integração de `@sia-dedg/shared-ui` no EvidêncIA e o procedimento para repetir a configuração nos demais projetos da organização `SIA-DEDG`.

## Estado da integração no EvidêncIA

Integração validada em 3 de setembro de 2026 com:

- `@sia-dedg/shared-ui@0.1.3` instalado diretamente do GitHub Packages;
- versão fixada em `package.json` e registrada em `package-lock.json`;
- build TypeScript e Vite concluído sem erros;
- nenhum token armazenado no repositório;
- header local antigo preservado temporariamente para comparação e rollback.

Para confirmar que a instalação não está usando um vínculo local, procure no lockfile:

```powershell
Select-String -Path package-lock.json -Pattern 'npm.pkg.github.com/download/@sia-dedg/shared-ui'
```

O resultado deve apresentar a versão instalada no domínio `npm.pkg.github.com`.

## 1. Pré-requisitos

- Node.js 20.19 ou superior.
- Acesso de leitura ao pacote privado no GitHub Packages.
- React 18.2 ou superior.
- O pacote `@sia-dedg/shared-ui` publicado na versão que será instalada.

O repositório consumidor precisa estar autorizado em **Package settings → Manage Actions access** no pacote `shared-ui`.

## 2. Autenticação local

Crie e mantenha no repositório apenas este `.npmrc`:

```ini
@sia-dedg:registry=https://npm.pkg.github.com
```

Crie um Personal Access Token classic no GitHub com `read:packages`. Se a organização exigir SSO, autorize o token para a organização. Faça login usando seu usuário do GitHub e o token como senha:

```powershell
npm login --scope=@sia-dedg --auth-type=legacy --registry=https://npm.pkg.github.com
```

Nunca coloque o token no `.npmrc` versionado. O `npm login` grava a credencial na configuração do usuário.

Confirme a autenticação antes de instalar:

```powershell
npm whoami --registry=https://npm.pkg.github.com
```

O comando deve retornar seu usuário pessoal do GitHub. Use um PAT **classic** como senha; não use a senha do GitHub, o nome da organização como usuário nem um token fine-grained.

## 3. Instalação

Instale uma versão explícita para evitar alterações involuntárias:

```powershell
npm install @sia-dedg/shared-ui@0.1.3 --save-exact
```

O `package.json` ficará com:

```json
{
  "dependencies": {
    "@sia-dedg/shared-ui": "0.1.3"
  }
}
```

O `package-lock.json` gerado deve ser commitado.

## 4. Arquivos usados no EvidêncIA

- `src/components/HeaderIntegration.tsx`: traduz o estado e as rotas do sistema para as propriedades públicas de `SiaHeader`.
- `src/data/headerSearchAdapter.ts`: adapta a busca por páginas e a busca inteligente existente para `HeaderSearchAdapter`.
- `src/App.tsx`: renderiza `HeaderIntegration` no lugar do header local.
- `.npmrc`: direciona somente o escopo `@sia-dedg` para o GitHub Packages.

O antigo `src/components/Header.tsx` foi preservado temporariamente para facilitar comparação e eventual rollback. Depois da homologação, ele e as classes CSS exclusivas dele podem ser removidos em uma alteração separada.

## 5. Importação obrigatória

```tsx
import { SiaHeader } from '@sia-dedg/shared-ui'
import '@sia-dedg/shared-ui/styles.css'
```

O CSS do componente já é compilado a partir do Tailwind e possui classes prefixadas com `sia-`. O projeto consumidor não precisa adicionar os arquivos da biblioteca ao `content` do Tailwind.

## 6. Configuração usada

```tsx
<SiaHeader
  currentProject="evidencia"
  logoSrc="/assets/logo.svg"
  logoAlt="Descrição acessível da logo"
  homeHref="/#/sobre"
  onHome={() => onNavigate('sobre')}
  navigationItems={navigationItems}
  activeNavigationId={activeNavigationId}
  onNavigation={onNavigation}
  search={searchAdapter}
  searchPlaceholder="Buscar no EvidêncIA"
  fontScale={fontScale}
  fontScales={[0.9, 1, 1.1, 1.2]}
  onFontScaleChange={onFontScaleChange}
  dataMeta={dataMeta}
/>
```

### Parâmetros principais

| Propriedade | Uso |
| --- | --- |
| `currentProject` | Identifica o portal atual no catálogo compartilhado. |
| `logoSrc` e `logoAlt` | Imagem da marca e descrição acessível. |
| `homeHref` | Fallback de navegação da logo; deve começar com `/`. |
| `onHome` | Integra o clique da logo ao roteamento do aplicativo. |
| `navigationItems` | Define texto, identificador, ordem e estado desabilitado dos botões inferiores. |
| `activeNavigationId` | Marca a seção ativa. |
| `onNavigation` | Converte o identificador selecionado em navegação do aplicativo. |
| `search` | Adaptador opcional que resolve, descreve e aplica resultados. |
| `fontScale` | Escala controlada pelo consumidor. |
| `onFontScaleChange` | Persiste e aplica a escala escolhida nos botões A-/A+. |
| `dataMeta` | Exibe última atualização e período dos dados. |

O drawer mobile é ativado automaticamente em larguras menores que 640 px e usa os mesmos itens de navegação e o mesmo adaptador de busca.

## 7. Como adaptar outro projeto

1. Autorize o repositório consumidor nas configurações do pacote.
2. Adicione o `.npmrc` sem token.
3. Autentique-se e instale uma versão explícita.
4. Copie o padrão de `HeaderIntegration.tsx`, não o arquivo literalmente.
5. Defina o `currentProject` correspondente ao catálogo da biblioteca.
6. Troque logo, rota inicial, itens e identificador ativo.
7. Conecte `onNavigation` ao React Router, hash router ou estado usado pelo projeto.
8. Implemente um `HeaderSearchAdapter` quando houver busca; omita `search` quando não houver.
9. Aplique `fontScale` no elemento raiz do conteúdo do projeto e persista o valor se necessário.
10. Teste desktop, largura abaixo de 640 px, teclado, clique na logo, busca e rotas desabilitadas.

Se o novo projeto ainda não existir em `HeaderProjectId` e `SIA_PROJECTS`, primeiro adicione-o na biblioteca compartilhada, publique uma nova versão e somente então use essa versão no consumidor.

## 8. Atualização da biblioteca

Uma publicação nova não atualiza os consumidores automaticamente. Em cada projeto, execute:

```powershell
npm install @sia-dedg/shared-ui@0.1.3 --save-exact
npm run build
```

Revise `package.json` e `package-lock.json`, valide visualmente e faça commit. Dependabot ou Renovate podem abrir essas atualizações automaticamente, mas a homologação continua sendo feita por projeto.

## 9. GitHub Actions do consumidor

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: 20
      registry-url: https://npm.pkg.github.com
      scope: '@sia-dedg'
      cache: npm

  - run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  - run: npm run build
```

Em serviços externos ao GitHub Actions, configure um secret próprio com um token de somente leitura e exponha-o como `NODE_AUTH_TOKEN` apenas durante a instalação.

## 10. Validação e problemas comuns

Execute:

```powershell
npm run build
npm run dev
```

Além do teste visual, confirme a origem instalada:

```powershell
npm ls @sia-dedg/shared-ui
Select-String -Path package-lock.json -Pattern 'npm.pkg.github.com/download/@sia-dedg/shared-ui'
```

Valide:

- logo direcionando para a página inicial;
- botões desktop e menu mobile;
- seção ativa e item desabilitado;
- busca comum e busca inteligente;
- A-/A+ e persistência da escala;
- metadados de atualização;
- botão de voltar ao topo;
- navegação por teclado e fechamento do drawer com `Escape`.

Erros comuns:

- `E401`: login ausente ou token inválido.
- `E403`: token sem `read:packages`, SSO não autorizado ou usuário sem acesso.
- `E404`: pacote/versão não publicado ou repositório não autorizado no pacote.
- Header sem estilo: falta `import '@sia-dedg/shared-ui/styles.css'`.
- Projeto ausente no seletor: catálogo da biblioteca ainda não contém o projeto ou está com `status: 'pending'`.
