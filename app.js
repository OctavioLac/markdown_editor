// Estado da aplicação
let currentFile = null;
let parsedContent = [];
let originalFileName = '';

// Elementos do DOM
const fileInput = document.getElementById('fileInput');
const editorArea = document.getElementById('editorArea');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const debugBtn = document.getElementById('debugBtn');
const fileName = document.getElementById('fileName');
const toast = document.getElementById('toast');

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
saveBtn.addEventListener('click', saveFile);
clearBtn.addEventListener('click', clearEditor);
debugBtn.addEventListener('click', openDebugConsole);

/**
 * Manipula a seleção de arquivo
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name);
    originalFileName = file.name;
    const reader = new FileReader();

    reader.onload = function(e) {
        console.log('File loaded successfully');
        const content = e.target.result;
        
        // Validar estrutura antes do parsing
        const validationIssues = validateMarkdownStructure(content);
        if (validationIssues.length > 0) {
            console.warn('Validation warnings:', validationIssues);
            // Mostrar aviso ao usuário mas continuar
            showToast(`Aviso: ${validationIssues.length} problema(s) estrutural(is) encontrado(s). Verifique o console (F12)`, 'info');
        }
        
        parseMarkdown(content);
        renderEditor();
        updateUI();
        showToast('Arquivo carregado com sucesso!', 'success');
    };

    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        showToast('Erro ao ler o arquivo', 'error');
    };

    reader.readAsText(file, 'UTF-8');
}

/**
 * Valida a estrutura do markdown antes do parsing
 */
function validateMarkdownStructure(content) {
    const issues = [];
    
    // Encontrar todas as tags de abertura
    const openingTags = content.match(/\[([^\]\/]+?)\]/g) || [];
    const closingTags = content.match(/\[\/([^\]]+?)\]/g) || [];
    
    console.log(`Validation: Found ${openingTags.length} opening tags and ${closingTags.length} closing tags`);
    
    // Verificar tags não fechadas (simplificado)
    const tagCounts = {};
    
    openingTags.forEach(tag => {
        const tagName = tag.replace(/[\[\]]/g, '').trim().toUpperCase();
        // Ignorar frontmatter e tags especiais
        if (tagName === '---') return;
        
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    });
    
    closingTags.forEach(tag => {
        const tagName = tag.replace(/[\[\/\]]/g, '').trim().toUpperCase();
        tagCounts[tagName] = (tagCounts[tagName] || 0) - 1;
    });
    
    // Reportar problemas
    Object.keys(tagCounts).forEach(tagName => {
        if (tagCounts[tagName] > 0) {
            issues.push(`Tag [${tagName}] não fechada (${tagCounts[tagName]} ocorrência(s))`);
        } else if (tagCounts[tagName] < 0) {
            issues.push(`Tag [/${tagName}] sem abertura (${Math.abs(tagCounts[tagName])} ocorrência(s))`);
        }
    });
    
    if (issues.length > 0) {
        console.warn('Validation issues found:', issues);
    } else {
        console.log('Validation passed: All tags are properly opened and closed');
    }
    
    return issues;
}

/**
 * Normaliza o conteúdo corrigindo erros comuns de LLMs
 */
function normalizeContent(content) {
    // Lista de tags conhecidas do sistema
    const knownTags = [
        'TITULO DO CURSO', 'TÍTULO DO CURSO',
        'PROFESSOR\\(ES\\)', 'PROFESSORES',
        'DEFINICAO', 'DEFINIÇÃO',
        'PROPOSITO', 'PROPÓSITO',
        'PREPARACAO', 'PREPARAÇÃO',
        'INTRODUCAO', 'INTRODUÇÃO',
        'MODULO', 'MÓDULO',
        'IMAGEM CAPA', 'IMAGEM MOD\\d+', 'IMAGEM \\d+',
        'NUCLEO_CONCEITUAL', 'NUCLEO CONCEITUAL', 'NÚCLEO CONCEITUAL',
        'SECAO', 'SEÇÃO',
        'SUBSECAO', 'SUBSEÇÃO',
        'OBJETIVO',
        'SAIBA_MAIS',
        'VIDEO', 'VÍDEO',
        'ATIVIDADES',
        'ATIVIDADE MODULO \\d+', 'ATIVIDADE MÓDULO \\d+',
        'PERGUNTA',
        'OPCOES', 'OPÇÕES',
        'GABARITO',
        'JUSTIFICATIVA',
        'PONTO_DE_RETORNO',
        'SIMULADO',
        'CONSIDERACOES_FINAIS', 'CONSIDERAÇÕES FINAIS',
        'EXPLORE_MAIS',
        'REFERENCIAS', 'REFERÊNCIAS',
        'ITENS FINAIS'
    ];
    
    let normalized = content;
    
    // Primeiro passo: normalizar delimitadores APENAS para tags conhecidas
    console.log('Normalizing delimiters...');
    
    // Construir regex que só pega delimitadores quando é uma tag conhecida
    // Isso evita destruir código HTML, JSON, etc.
    knownTags.forEach(tag => {
        // Escape caracteres especiais do regex exceto os marcadores de grupo
        const tagPattern = tag.replace(/[()]/g, '\\$&');
        
        // Tags de abertura com delimitadores errados
        normalized = normalized.replace(new RegExp(`\\{(${tagPattern})\\]`, 'gi'), '[$1]');
        normalized = normalized.replace(new RegExp(`\\[(${tagPattern})>`, 'gi'), '[$1]');
        normalized = normalized.replace(new RegExp(`\\[(${tagPattern})\\}`, 'gi'), '[$1]');
        normalized = normalized.replace(new RegExp(`\\{(${tagPattern})\\}`, 'gi'), '[$1]');
        normalized = normalized.replace(new RegExp(`<(${tagPattern})>`, 'gi'), '[$1]');
        normalized = normalized.replace(new RegExp(`<(${tagPattern})\\]`, 'gi'), '[$1]');
        
        // Tags de fechamento com delimitadores errados
        normalized = normalized.replace(new RegExp(`\\{\\/(${tagPattern})\\]`, 'gi'), '[/$1]');
        normalized = normalized.replace(new RegExp(`\\[\\/(${tagPattern})>`, 'gi'), '[/$1]');
        normalized = normalized.replace(new RegExp(`\\[\\/(${tagPattern})\\}`, 'gi'), '[/$1]');
        normalized = normalized.replace(new RegExp(`\\{\\/(${tagPattern})\\}`, 'gi'), '[/$1]');
        normalized = normalized.replace(new RegExp(`<\\/(${tagPattern})>`, 'gi'), '[/$1]');
        normalized = normalized.replace(new RegExp(`<\\/(${tagPattern})\\]`, 'gi'), '[/$1]');
    });
    
    // Segundo passo: corrigir typos específicos com regex flexível
    console.log('Normalizing typos...');
    
    // NUCLEO CONCEITUAL com todas as variações possíveis de typo
    normalized = normalized.replace(
        /\[(N[UÚ]CLEO[\s_-]*CONCEI[TtSs]*[UuAa]*[AaLl]*)\]/gi,
        '[NUCLEO_CONCEITUAL]'
    );
    normalized = normalized.replace(
        /\[\/(N[UÚ]CLEO[\s_-]*CONCEI[TtSs]*[UuAa]*[AaLl]*)\]/gi,
        '[/NUCLEO_CONCEITUAL]'
    );
    
    // SUBSECAO com typos variados
    normalized = normalized.replace(
        /\[(SUB[\s-]?SE[CÇ][AÃ]O)\]/gi,
        '[SUBSECAO]'
    );
    normalized = normalized.replace(
        /\[\/(SUB[\s-]?SE[CÇ][AÃ]O)\]/gi,
        '[/SUBSECAO]'
    );
    
    // SECAO com typos (cuidado para não pegar SUBSECAO)
    normalized = normalized.replace(
        /\[(?!SUB)(SE[CÇ][AÃ]O)\]/gi,
        '[SECAO]'
    );
    normalized = normalized.replace(
        /\[\/(?!SUB)(SE[CÇ][AÃ]O)\]/gi,
        '[/SECAO]'
    );
    
    // Terceiro passo: normalizar acentos e variações nas tags
    console.log('Normalizing accents...');
    
    const tagNormalizations = {
        // Título
        'TÍTULO DO CURSO': 'TITULO DO CURSO',
        'TITULO DO CURSO': 'TITULO DO CURSO',
        
        // Definição
        'DEFINIÇÃO': 'DEFINICAO',
        'DEFINICAO': 'DEFINICAO',
        
        // Propósito
        'PROPÓSITO': 'PROPOSITO',
        'PROPOSITO': 'PROPOSITO',
        
        // Preparação
        'PREPARAÇÃO': 'PREPARACAO',
        'PREPARACAO': 'PREPARACAO',
        
        // Introdução
        'INTRODUÇÃO': 'INTRODUCAO',
        'INTRODUCAO': 'INTRODUCAO',
        
        // Módulo
        'MÓDULO': 'MODULO',
        'MODULO': 'MODULO',
        
        // Núcleo Conceitual - muitas variações de typos
        'NÚCLEO CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NÚCLEO_CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NUCLEO CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NUCLEO_CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NÚCLEO CONCEITAUL': 'NUCLEO_CONCEITUAL',
        'NUCLEO CONCEITAUL': 'NUCLEO_CONCEITUAL',
        'NÚCLEO CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NUCLEO CONCEITUAL': 'NUCLEO_CONCEITUAL',
        'NUCLEO CONCEITUA': 'NUCLEO_CONCEITUAL',
        'NUCLEO CONCEI TUAL': 'NUCLEO_CONCEITUAL',
        'NÚCLEO CONCEI TUAL': 'NUCLEO_CONCEITUAL',
        'NUCLEO_CONCEITAUL': 'NUCLEO_CONCEITUAL',
        'NUCLEO_CONCEITUA': 'NUCLEO_CONCEITUAL',
        
        // Seção
        'SEÇÃO': 'SECAO',
        'SECAO': 'SECAO',
        'SECÃO': 'SECAO',
        
        // Subseção  
        'SUBSEÇÃO': 'SUBSECAO',
        'SUBSECAO': 'SUBSECAO',
        'SUBSECÃO': 'SUBSECAO',
        
        // Vídeo
        'VÍDEO': 'VIDEO',
        'VIDEO': 'VIDEO',
        
        // Opções
        'OPÇÕES': 'OPCOES',
        'OPCOES': 'OPCOES',
        'OPCÕES': 'OPCOES',
        
        // Atividade Módulo
        'ATIVIDADE MÓDULO': 'ATIVIDADE MODULO',
        'ATIVIDADE MODULO': 'ATIVIDADE MODULO',
        
        // Considerações Finais
        'CONSIDERAÇÕES FINAIS': 'CONSIDERACOES_FINAIS',
        'CONSIDERAÇÕES_FINAIS': 'CONSIDERACOES_FINAIS',
        'CONSIDERACOES FINAIS': 'CONSIDERACOES_FINAIS',
        'CONSIDERACOES_FINAIS': 'CONSIDERACOES_FINAIS',
        
        // Referências
        'REFERÊNCIAS': 'REFERENCIAS',
        'REFERENCIAS': 'REFERENCIAS',
        'REFERÊNIAS': 'REFERENCIAS'
    };
    
    Object.keys(tagNormalizations).forEach(wrongTag => {
        const correctTag = tagNormalizations[wrongTag];
        // Abertura
        normalized = normalized.replace(
            new RegExp(`\\[${wrongTag}\\]`, 'gi'),
            `[${correctTag}]`
        );
        // Fechamento
        normalized = normalized.replace(
            new RegExp(`\\[/${wrongTag}\\]`, 'gi'),
            `[/${correctTag}]`
        );
    });
    
    console.log('Content normalized');
    return normalized;
}

/**
 * Parse conteúdo aninhado (ATIVIDADES, SIMULADO)
 */
function parseNestedContent(content, parentTag) {
    const nestedItems = [];
    
    // Para ATIVIDADES, procurar por [ATIVIDADE MODULO X]
    if (parentTag === 'ATIVIDADES') {
        const sectionPattern = /\[ATIVIDADE MODULO \d+\]\s*\r?\n([\s\S]*?)(?=\[ATIVIDADE MODULO \d+\]|\[\/ATIVIDADE MODULO \d+\]|$)/gi;
        const sections = [];
        
        let match;
        while ((match = sectionPattern.exec(content)) !== null) {
            const fullMatch = match[0];
            const sectionName = fullMatch.split(']')[0].substring(1);
            const sectionContent = match[1].trim();
            
            sections.push({
                name: sectionName,
                content: sectionContent
            });
        }
        
        if (sections.length > 0) {
            console.log(`Found ${sections.length} main sections`);
            
            // Para cada seção, parsear as tags individuais
            for (const section of sections) {
                // Contador de perguntas para esta seção
                let perguntaCount = 0;
                
                const tagPattern = /\[([^\]\/]+?)\]\s*\r?\n([\s\S]*?)(?=\r?\n\[(?!\/)|$)/g;
                
                let tagMatch;
                while ((tagMatch = tagPattern.exec(section.content)) !== null) {
                    const tag = tagMatch[1].trim();
                    let tagContent = tagMatch[2].trim();
                    
                    // Limpar fechamento se existir
                    tagContent = tagContent.replace(new RegExp(`\\[\\/${tag}\\]\\s*$`, 'i'), '').trim();
                    
                    if (tagContent) {
                        // Se for uma pergunta, incrementar contador e adicionar ao nome
                        let displayTag = tag;
                        const tagUpper = tag.toUpperCase();
                        
                        if (tagUpper === 'PERGUNTA') {
                            perguntaCount++;
                            // Extrair número do módulo
                            const moduleMatch = section.name.match(/MODULO\s+(\d+)/i);
                            const moduleNum = moduleMatch ? moduleMatch[1] : '?';
                            displayTag = `PERGUNTA ${perguntaCount} - Módulo ${moduleNum}`;
                        } else if (['OPCOES', 'GABARITO', 'JUSTIFICATIVA', 'PONTO_DE_RETORNO'].includes(tagUpper)) {
                            // Para tags relacionadas à pergunta, adicionar contexto
                            const moduleMatch = section.name.match(/MODULO\s+(\d+)/i);
                            const moduleNum = moduleMatch ? moduleMatch[1] : '?';
                            displayTag = `${tag} (Q${perguntaCount} - Mod ${moduleNum})`;
                        }
                        
                        nestedItems.push({
                            type: 'tag',
                            tag: displayTag,
                            content: tagContent,
                            parent: parentTag,
                            section: section.name,
                            originalTag: tag  // Manter tag original para regeneração
                        });
                    }
                }
            }
        }
    }
    
    return nestedItems;
}

/**
 * Faz o parsing do conteúdo markdown
 */
function parseMarkdown(content) {
    parsedContent = [];
    
    console.log('Parsing content, length:', content.length);
    
    // NORMALIZAR CONTEÚDO ANTES DE PROCESSAR
    content = normalizeContent(content);
    
    // Regex para capturar frontmatter YAML
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const frontmatterMatch = content.match(frontmatterRegex);
    
    let remainingContent = content;
    
    // Se há frontmatter, extrair e processar
    if (frontmatterMatch) {
        const frontmatterContent = frontmatterMatch[1];
        parsedContent.push({
            type: 'frontmatter',
            tag: 'FRONTMATTER',
            content: frontmatterContent
        });
        
        console.log('Frontmatter found');
        // Remove o frontmatter do conteúdo restante
        remainingContent = content.substring(frontmatterMatch[0].length).trim();
    }
    
    // Lista de tags que NÃO devem ter conteúdo após (apenas SECAO e SUBSECAO podem ter)
    const sectionTags = ['SECAO', 'SEÇÃO', 'SUBSECAO', 'SUBSEÇÃO'];
    
    // Regex para encontrar todas as tags [TAG]...[/TAG]
    const tagRegex = /\[([^\]\/]+?)\]\s*\r?\n([\s\S]*?)\[\/\1\]/gi;
    
    let lastIndex = 0;
    let match;
    const matches = [];
    
    // Primeiro, coletar todas as matches com suas posições
    while ((match = tagRegex.exec(remainingContent)) !== null) {
        matches.push({
            fullMatch: match[0],
            tag: match[1].trim(),
            content: match[2].trim(),
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }
    
    console.log(`Found ${matches.length} tag pairs`);
    
    // Processar cada match
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const tagUpper = current.tag.toUpperCase();
        
        console.log(`Processing tag: ${current.tag}`);
        
        // Verificar se é uma tag que contém sub-tags (ATIVIDADES, SIMULADO)
        if (tagUpper === 'ATIVIDADES' || tagUpper === 'SIMULADO') {
            console.log(`Tag with nested content detected: ${current.tag}`);
            
            // Parsear sub-tags
            const nestedItems = parseNestedContent(current.content, current.tag);
            
            if (nestedItems.length > 0) {
                // Adicionar as sub-tags diretamente à lista
                parsedContent.push(...nestedItems);
            } else {
                // Se não encontrou sub-tags, adicionar como tag normal
                parsedContent.push({
                    type: 'tag',
                    tag: current.tag,
                    content: current.content
                });
            }
        } else {
            // Tag normal - adicionar SÓ o conteúdo DENTRO da tag
            parsedContent.push({
                type: 'tag',
                tag: current.tag,
                content: current.content
            });
        }
        
        // Calcular conteúdo APÓS a tag (fora dela)
        const currentEnd = current.endIndex;
        let contentAfter = '';
        
        if (i < matches.length - 1) {
            const nextStart = matches[i + 1].startIndex;
            contentAfter = remainingContent.substring(currentEnd, nextStart).trim();
        } else {
            contentAfter = remainingContent.substring(currentEnd).trim();
        }
        
        // Verificar se há conteúdo significativo APÓS a tag
        if (contentAfter && contentAfter.length > 10 && !contentAfter.startsWith('[')) {
            const isSection = sectionTags.some(st => tagUpper.includes(st));
            const isNucleo = tagUpper.includes('NUCLEO');
            
            // Criar campo separado para conteúdo que vem DEPOIS da tag
            let label;
            if (isSection) {
                const labelSuffix = tagUpper.includes('SUB') ? 'Subseção' : 'Seção';
                label = `Conteúdo da ${labelSuffix} acima`;
            } else if (isNucleo) {
                label = 'Conteúdo do Núcleo Conceitual acima';
            } else {
                // Para outras tags, criar campo genérico
                label = `Conteúdo de ${current.tag} acima`;
            }
            
            console.log(`Content after detected: ${contentAfter.substring(0, 50)}...`);
            
            parsedContent.push({
                type: 'content-after',
                tag: label,
                content: contentAfter,
                relatedTo: current.tag
            });
        }
    }
    
    console.log('Total items parsed:', parsedContent.length);
    
    // Validação: verificar se há tags não fechadas ou mal formatadas
    const unclosedTags = remainingContent.match(/\[([^\]\/]+?)\](?!\s*\r?\n[\s\S]*?\[\/\1\])/g);
    if (unclosedTags && unclosedTags.length > 0) {
        console.warn('Warning: Found unclosed tags:', unclosedTags);
    }
}

/**
 * Renderiza o editor com os campos
 */
function renderEditor() {
    console.log('Rendering editor with', parsedContent.length, 'items');
    
    if (parsedContent.length === 0) {
        editorArea.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <h3>Nenhum campo encontrado</h3>
                <p>O arquivo não contém tags reconhecíveis no formato [TAG]...[/TAG]</p>
                <p style="margin-top: 10px; font-size: 12px; color: #999;">Verifique o console do navegador (F12) para mais detalhes</p>
            </div>
        `;
        return;
    }

    editorArea.innerHTML = '';
    
    parsedContent.forEach((item, index) => {
        console.log('Rendering item', index, ':', item.tag);
        
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';
        
        // Aplicar estilos específicos por tipo
        if (item.type === 'frontmatter') {
            fieldGroup.classList.add('frontmatter-group');
        } else if (item.type === 'content-after') {
            fieldGroup.classList.add('content-after-group');
        }
        
        const label = document.createElement('div');
        label.className = 'field-label';
        
        // Aplicar estilos de label específicos
        if (item.type === 'frontmatter') {
            label.classList.add('frontmatter-label');
        } else if (item.type === 'content-after') {
            label.classList.add('content-after-label');
        }
        
        label.textContent = item.tag;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'field-input';
        textarea.value = item.content;
        textarea.dataset.index = index;
        
        // Ajusta a altura do textarea baseado no conteúdo
        const lines = item.content.split('\n').length;
        textarea.style.minHeight = `${Math.max(60, lines * 24 + 24)}px`;
        
        // Atualiza o conteúdo quando o usuário editar
        textarea.addEventListener('input', function() {
            parsedContent[index].content = this.value;
            // Auto-resize
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        
        fieldGroup.appendChild(label);
        fieldGroup.appendChild(textarea);
        editorArea.appendChild(fieldGroup);
    });
    
    console.log('Rendering complete');
}

/**
 * Gera o markdown a partir dos campos editados
 */
function generateMarkdown() {
    let markdown = '';
    let i = 0;
    
    while (i < parsedContent.length) {
        const item = parsedContent[i];
        
        if (item.type === 'frontmatter') {
            // Garantir que o frontmatter não tenha --- no conteúdo
            let cleanContent = item.content.replace(/^---\s*\n?|\n?---\s*$/g, '').trim();
            markdown += `---\n${cleanContent}\n---\n\n`;
        } 
        else if (item.type === 'tag') {
            // Verificar se é uma tag aninhada (tem parent)
            if (item.parent) {
                const parentTag = item.parent;
                
                // Verificar se tem seção (ATIVIDADE MODULO X)
                if (item.section) {
                    const currentSection = item.section;
                    
                    // Começar wrapper ATIVIDADES se for o primeiro
                    if (i === 0 || !parsedContent[i-1].parent || parsedContent[i-1].parent !== parentTag) {
                        markdown += `[${parentTag}]\n`;
                    }
                    
                    // Começar seção se mudou
                    if (i === 0 || parsedContent[i-1].section !== currentSection) {
                        markdown += `[${currentSection}]\n\n`;
                    }
                    
                    // Usar tag original se disponível, senão usar a tag de display
                    const tagToWrite = item.originalTag || item.tag;
                    
                    // Adicionar a tag individual
                    markdown += `[${tagToWrite}]\n${item.content}\n[/${tagToWrite}]\n\n`;
                    
                    // Verificar se é a última da seção
                    if (i + 1 >= parsedContent.length || parsedContent[i+1].section !== currentSection) {
                        markdown += `[/${currentSection}]\n\n`;
                    }
                    
                    // Verificar se é a última do parent
                    if (i + 1 >= parsedContent.length || !parsedContent[i+1].parent || parsedContent[i+1].parent !== parentTag) {
                        markdown += `[/${parentTag}]\n\n`;
                    }
                } else {
                    // Tag aninhada sem seção - agrupar por parent
                    // Começar wrapper se for o primeiro
                    if (i === 0 || !parsedContent[i-1].parent || parsedContent[i-1].parent !== parentTag) {
                        markdown += `[${parentTag}]\n`;
                    }
                    
                    // Adicionar tag
                    markdown += `[${item.tag}]\n${item.content}\n[/${item.tag}]\n\n`;
                    
                    // Fechar wrapper se for o último
                    if (i + 1 >= parsedContent.length || !parsedContent[i+1].parent || parsedContent[i+1].parent !== parentTag) {
                        markdown += `[/${parentTag}]\n\n`;
                    }
                }
            } else {
                // Tag normal
                // Remover tags que possam estar dentro do conteúdo
                let cleanContent = item.content;
                const tagPattern = /\[([^\]]+)\][\s\S]*?\[\/\1\]/g;
                if (tagPattern.test(cleanContent)) {
                    console.warn(`Warning: Nested tags found in ${item.tag}, they will be removed`);
                    cleanContent = cleanContent.replace(tagPattern, '');
                }
                
                markdown += `[${item.tag}]\n${cleanContent}\n[/${item.tag}]\n`;
                
                // Verificar se o próximo é content-after relacionado
                if (i + 1 < parsedContent.length) {
                    const nextItem = parsedContent[i + 1];
                    if (nextItem.type === 'content-after' && nextItem.relatedTo === item.tag) {
                        // Adicionar o conteúdo APÓS a tag
                        markdown += `\n${nextItem.content}\n`;
                        i++; // Pular o próximo item
                    }
                }
                markdown += '\n';
            }
        }
        else if (item.type === 'content-after') {
            // Se chegou aqui, significa que não foi processado como parte de uma tag
            markdown += `${item.content}\n\n`;
        }
        
        i++;
    }
    
    return markdown.trim() + '\n';
}

/**
 * Salva o arquivo editado
 */
function saveFile() {
    if (parsedContent.length === 0) {
        showToast('Nenhum conteúdo para salvar', 'error');
        return;
    }

    const markdown = generateMarkdown();
    
    // Validar o markdown gerado antes de salvar
    const validationIssues = validateMarkdownStructure(markdown);
    if (validationIssues.length > 0) {
        console.error('Validation errors in generated markdown:', validationIssues);
        const proceed = confirm(
            `ATENÇÃO: O arquivo gerado contém ${validationIssues.length} problema(s) de estrutura:\n\n` +
            validationIssues.join('\n') +
            '\n\nIsso pode causar erros na próxima etapa do processamento.\n\n' +
            'Deseja salvar mesmo assim? (Recomenda-se revisar no editor primeiro)'
        );
        
        if (!proceed) {
            showToast('Salvamento cancelado. Revise os campos no editor.', 'info');
            return;
        }
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
    
    // Gera nome do arquivo de saída
    const baseName = originalFileName.replace(/\.md$/, '');
    const outputFileName = `${baseName}_editado.md`;
    
    // Cria link de download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('File saved:', outputFileName);
    console.log('Content preview:', markdown.substring(0, 500));
    
    showToast('Arquivo salvo com sucesso!', 'success');
}

/**
 * Limpa o editor
 */
function clearEditor() {
    if (confirm('Tem certeza que deseja limpar o editor? Todas as alterações não salvas serão perdidas.')) {
        parsedContent = [];
        currentFile = null;
        originalFileName = '';
        fileInput.value = '';
        renderEditor();
        updateUI();
        showToast('Editor limpo', 'info');
    }
}

/**
 * Atualiza a interface
 */
function updateUI() {
    const hasContent = parsedContent.length > 0;
    saveBtn.disabled = !hasContent;
    clearBtn.disabled = !hasContent;
    fileName.textContent = originalFileName || 'Nenhum arquivo selecionado';
}

/**
 * Mostra mensagem toast
 */
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Abre o console de debug
 */
function openDebugConsole() {
    console.log('=== DEBUG INFO ===');
    console.log('Arquivo carregado:', originalFileName);
    console.log('Total de campos:', parsedContent.length);
    console.log('Campos encontrados:', parsedContent.map(item => item.tag));
    
    if (parsedContent.length > 0) {
        console.log('\nPrimeiro campo:', parsedContent[0]);
        console.log('\nTodos os campos:', parsedContent);
    }
    
    showToast('Informações de debug no console (F12)', 'info');
    alert('Console de debug aberto!\n\nPressione F12 para ver os detalhes no console do navegador.\n\nCampos encontrados: ' + parsedContent.length);
}

// Inicialização
updateUI();
