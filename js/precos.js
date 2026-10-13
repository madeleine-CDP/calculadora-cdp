// Tabelas de preço e regras das fábricas (Real, Decore) e da CDP.
// Ver CLAUDE.md → "Fábricas e fórmulas" antes de alterar qualquer valor.

// ═══════════════════════════════════════════════════════
// VERSÃO DAS TABELAS — aparece no botão da fábrica e no aviso abaixo dos valores.
// Ao trocar de tabela, atualize SÓ AQUI (não mexe em nenhum preço).
const TABELAS_INFO = {
  real: { nome: 'Real Persianas',  tabela: 'Agosto/2026',  data: '16/09/2026', rotulo: 'conferida em' },
  dec:  { nome: 'Decore',          tabela: 'Outubro/2026', data: '01/10/2026', rotulo: 'vigente desde' },
  cdp:  { nome: 'CDP',             tabela: 'tabela própria', data: '',         rotulo: '' }
};
function textoTabela(fab){
  const t = TABELAS_INFO[fab]; if(!t) return '';
  if(!t.data) return 'tabela ' + t.nome + ' (' + t.tabela + ', data da última atualização ainda não registrada)';
  return 'tabela ' + t.nome + ' de ' + t.tabela + ' (' + t.rotulo + ' ' + t.data + ')';
}

// ═══════════════════════════════════════════════════════
// DADOS BASE — PRODUTOS COM LIMITES E COLEÇÕES
// ═══════════════════════════════════════════════════════

// Larguras de tecido por coleção (Real)
const FABRIC_W_REAL = {
  // Rolô BK
  "BK Pinpoint":2.50,"BK Napole":2.40,"BK Euro":3.00,"BK Max Pinpoint":3.00,
  "BK Iene":2.80,"BK New Rial":3.00,"BK Cardano":2.50,"BK Yuan":2.80,
  "BK Grivnia":2.00,"BK Kina":2.00,"BK Pataca":2.80,"BK Quiate":2.00,"BK Manat":2.40,
  // Screen
  "Screen 5% Fit":3.00,"Screen 5%":3.00,"Screen 3%":3.00,"Screen 1%":3.00,"Screen 5% Especial":3.00,
  // Translucido
  "Napole Luz":2.40,"Euro Translúcido":3.00,"Metical":2.80,"Yuan Translúcido":2.80,
  "Kina":2.00,"Quiate Luz":2.00,"Bolivar":2.00,"Dalásia":2.00,"Naira":2.50,
  // Elegance
  "Basic":2.15,"Stile":3.00,"Shadow":3.00,"Semi Blackout":3.00,
  // Nuette
  "Nuette Basic":2.60,
  // Celular
  "Luna":99,"BK Cocoon":99
};

// Larguras de tecido por coleção (Decore)
const FABRIC_W_DECORE = {
  // Rolô BK
  "BK Berlim":2.50,"BK Pinpoint Soft":3.00,"BK Pinpoint Flex":3.00,"BK Libia":2.20,
  "BK Pinpoint Plus":3.00,"BK Monaco":3.00,"BK Madri":3.00,"BK Lugano":3.00,
  "BK Napoles":2.40,"BK Lins":2.80,"BK Manari":3.00,"BK Elise":2.00,
  "BK Fustão":2.80,"BK Aurea":2.40,"BK Inca":2.00,"BK Viena":2.80,
  "BK Prestige":2.80,"BK Rustico":3.00,"BK Screen":3.00,
  // Filtra-sol
  "Hydra 5%":3.00,"Malta 3%":3.00,"Betis 1%":3.00,
  // Translucido Rolô
  "Delta":2.00,"Monaco Luz":2.50,"Fustão Luz":2.00,"Lugano Luz":3.00,
  "Carlota":2.00,"Atlas":2.00,"Book":2.00,"Linho Misto":2.00,"Maia":2.00,
  "Napoles Luz":2.40,"Inca Luz":2.00,"Laus":2.00,"Rustico Luz":3.00,"Odin Luz":1.40,
  // Double Vision
  "Opala":3.00,"Jade":2.25,"Babel":2.25,"Diamante":3.00,"Topázio SBK":3.00,
  // Vertical
  "Nuance":99,"Paris":99,"Nantes":99,"PVC Slim":99,"PVC Basic":99
};

// Tabelas promocionais Decore (aplica 3% desc)
const DECORE_PROMO_COLS = [
  "Hydra 5%","Malta 3%","Betis 1%",
  "BK Pinpoint Flex","BK Berlim","BK Mônaco","BK Nápoles",
  "Mônaco Luz","Lugano Luz","Nápoles Luz"
];

// Impostos PE
const IMPOSTOS_PE = {
  "tecido":     {ipi:0,     st:0},
  "pvc":        {ipi:0.0325,st:0},
  "aluminio":   {ipi:0.0325,st:0.0987},
  "madeira":    {ipi:0,     st:0},
  "celular":    {ipi:0,     st:0},
  "acessorio_pvc":  {ipi:0.0325,st:0.1602},
  "acessorio_alum": {ipi:0.0325,st:0.0987}
};

function getImpostos(tipoProd) {
  if(!tipoProd) return {ipi:0,st:0};
  return IMPOSTOS_PE[tipoProd] || {ipi:0,st:0};
}

// Tipo de imposto por produto+familia
function getTipoImposto(prod, fam) {
  if(prod.includes("VERTICAL") && fam==="PVC") return "pvc";
  if(prod.includes("VERTICAL")) return "tecido";
  if(prod.includes("HORIZONTAL") && fam.includes("ALUMÍNIO")) return "aluminio";
  if(prod.includes("HORIZONTAL") && fam.includes("PVC")) return "pvc";
  if(prod.includes("HORIZONTAL") && fam.includes("MADEIRA")) return "madeira";
  if(prod.includes("HORIZONTAL")) return "aluminio";
  if(prod.includes("CELULAR")) return "celular";
  return "tecido"; // cortinas em geral
}

// Tubos Real — Rolô
const TUBOS_REAL = [
  {id:"32mm",  label:"Tubo 32mm",       maxLarg:1.80, maxAlt:2.00, maxM2:4.00, bandos:["Bandô Standard","Bandô Solution","Bandô Box 32"]},
  {id:"40mm",  label:"Tubo 40mm",       maxLarg:2.40, maxAlt:2.50, maxM2:5.00, bandos:["Bandô Standard","Bandô Solution","Bandô Box 40"]},
  {id:"55mm",  label:"Tubo 55mm RPC",   maxLarg:3.00, maxAlt:3.00, maxM2:6.00, bandos:["Bandô Standard","Bandô Solution","Bandô Box 40","Bandô Box Plus"]},
  {id:"55mmR", label:"Tubo 55mm R Plus",maxLarg:4.00, maxAlt:3.50, maxM2:8.00, bandos:["Bandô Maxi","Bandô Plus","Bandô Box Plus"]}
];

function getTuboReal(w, h) {
  const area = w * h;
  for(const t of TUBOS_REAL) {
    if(w <= t.maxLarg && h <= t.maxAlt && area <= t.maxM2) return t;
  }
  return null;
}

// CATMAP
const CATMAP = {
  "CORTINAS": {
    "CORTINA ROLÔ":["BLACKOUT","FILTRA-SOL","TRANSLÚCIDA"],
    "CORTINA ROMANA":["BLACKOUT","FILTRA-SOL","TRANSLÚCIDA"],
    "CORTINA PAINEL":["BLACKOUT","FILTRA-SOL","TRANSLÚCIDA"],
    "CORTINA ELEGANCE / DOUBLE VISION":["TRANSLÚCIDA","SEMI BLACKOUT"],
    "CORTINA NUETTE":["TECIDO"],
    "CORTINA CELULAR":["TRANSLÚCIDA","BLACKOUT"]
  },
  "PERSIANAS": {
    "PERSIANA VERTICAL":["TRANSLÚCIDA","FILTRA-SOL","BLACKOUT","PVC"],
    "PERSIANA HORIZONTAL":["16MM","25MM","50MM — ALUMÍNIO","50MM — PVC","50MM — MADEIRA / BAMBU"]
  }
};

// DB REAL
const DB_REAL = {
  "CORTINAS|CORTINA ROLÔ|BLACKOUT":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.4,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Alt mínima: 1,00m",
      "Larg máxima depende do tubo selecionado (automático)",
      "Tecido SCREEN/PINPOINT com larg >3,00m e alt >2,70m: SOLDA horizontal obrigatória",
      "Base revestida: +R$15,00 por cortina | Prazo: 5 dias úteis"
    ],
    cols:{
      "BK Pinpoint":{
        p:146.77,
        fw:2.5
      },
      "BK Euro":{
        p:164.9,
        fw:3.0
      },
      "BK Max Pinpoint":{
        p:165.21,
        fw:3.0
      },
      "BK Napole":{
        p:165.75,
        fw:2.4
      },
      "BK Etherium":{
        p:172.9,
        fw:2.5
      },
      "BK Manat":{
        p:180.58,
        fw:2.4
      },
      "BK Cardano":{
        p:183.21,
        fw:2.5
      },
      "BK Iene":{
        p:187.53,
        fw:2.8
      },
      "BK Quiate":{
        p:205.77,
        fw:2.0
      },
      "BK Yuan":{
        p:206.8,
        fw:2.8
      },
      "BK Pataca":{
        p:239.4,
        fw:2.8
      },
      "BK Grivnia":{
        p:245.4,
        fw:2.0
      }
    },
    maxLarg:4.0,
    maxAlt:3.5,
    maxM2:8.0
  },
  "CORTINAS|CORTINA ROLÔ|FILTRA-SOL":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.4,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Larg máx: 3,00m | Alt máx: 3,00m",
      "Base revestida: +R$15,00 por cortina | Prazo: 5 dias úteis"
    ],
    cols:{
      "Screen 5% Fit":{
        p:125.87,
        fw:3.0
      },
      "Screen 5%":{
        p:137.65,
        fw:3.0
      },
      "Screen 3%":{
        p:145.84,
        fw:3.0
      },
      "Screen 1%":{
        p:163.04,
        fw:3.0
      },
      "Screen 5% Especial":{
        p:202.92,
        fw:3.0
      }
    },
    maxLarg:3.0,
    maxAlt:3.0,
    maxM2:6.0
  },
  "CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.4,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Base revestida: +R$15,00 por cortina | Prazo: 5 dias úteis"
    ],
    cols:{
      "Napole Luz":{
        p:123.5,
        fw:2.6
      },
      "Euro Translúcido":{
        p:130.0,
        fw:3.0
      },
      "Yuan Translúcido":{
        p:132.3,
        fw:2.8
      },
      Kina:{
        p:135.93,
        fw:2.0
      },
      Metical:{
        p:141.19,
        fw:2.8
      },
      "Quiate Luz":{
        p:144.94,
        fw:2.0
      }
    },
    maxLarg:3.0,
    maxAlt:3.0,
    maxM2:6.0
  },
  "CORTINAS|CORTINA ROMANA|BLACKOUT":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:2.8,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Larg máx: 2,80m | Cobrança mínima: 1,20 m²",
      "Gomos: alt 0,50-1,10→3g | 1,11-1,80→5g | 1,81-2,50→7g | 2,51-3,50→9g",
      "Base revestida: +R$15,00 | Medidas fora do padrão: +20% | Prazo: 5 dias úteis"
    ],
    cols:{
      "BK Pinpoint":{
        p:176.13,
        fw:2.5
      },
      "BK Euro":{
        p:197.88,
        fw:2.8
      },
      "BK Napole":{
        p:198.9,
        fw:2.4
      },
      "BK Etherium":{
        p:207.48,
        fw:2.8
      },
      "BK Manat":{
        p:216.69,
        fw:2.4
      },
      "BK Cardano":{
        p:219.85,
        fw:2.5
      },
      "BK Iene":{
        p:225.04,
        fw:2.8
      },
      "BK Quiate":{
        p:246.92,
        fw:2.0
      },
      "BK Yuan":{
        p:248.16,
        fw:2.8
      },
      "BK Pataca":{
        p:287.28,
        fw:2.8
      },
      "BK Grivnia":{
        p:294.48,
        fw:2.0
      }
    }
  },
  "CORTINAS|CORTINA ROMANA|FILTRA-SOL":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:2.8,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Larg máx: 2,80m | Cobrança mínima: 1,20 m² | Prazo: 5 dias úteis"
    ],
    cols:{
      "Screen 5% Fit":{
        p:151.04,
        fw:2.8
      },
      "Screen 5%":{
        p:165.18,
        fw:2.8
      },
      "Screen 3%":{
        p:175.01,
        fw:2.8
      },
      "Screen 1%":{
        p:195.65,
        fw:2.8
      },
      "Screen 5% Especial":{
        p:243.5,
        fw:2.8
      }
    }
  },
  "CORTINAS|CORTINA ROMANA|TRANSLÚCIDA":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:2.8,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Larg máx: 2,80m | Cobrança mínima: 1,20 m² | Prazo: 5 dias úteis"
    ],
    cols:{
      "Napole Luz":{
        p:148.2,
        fw:2.4
      },
      "Euro Translúcido":{
        p:156.0,
        fw:2.8
      },
      "Yuan Translúcido":{
        p:158.76,
        fw:2.8
      },
      Kina:{
        p:163.11,
        fw:2.0
      },
      Metical:{
        p:169.43,
        fw:2.8
      },
      "Quiate Luz":{
        p:173.93,
        fw:2.0
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|BLACKOUT":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.6,
    maxLarg:4.0,
    maxAlt:3.0,
    maxM2:15.5,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Transpasse padrão: 8cm; acima +10%",
      "Folhas: 0,60-1,65m→3fls | 1,66-2,20m→4fls | 2,21-4,00m→5fls",
      "Base revestida: +R$15,00 por cortina | Prazo: 5 dias úteis"
    ],
    subCols:{
      "Painel Europa":{
        "BK Pinpoint":{
          p:161.45,
          fw:99
        },
        "BK Euro":{
          p:181.39,
          fw:99
        },
        "BK Napole":{
          p:182.33,
          fw:99
        },
        "BK Etherium":{
          p:190.19,
          fw:99
        },
        "BK Manat":{
          p:198.63,
          fw:99
        },
        "BK Cardano":{
          p:201.53,
          fw:99
        },
        "BK Iene":{
          p:206.28,
          fw:99
        },
        "BK Quiate":{
          p:226.35,
          fw:99
        },
        "BK Yuan":{
          p:227.48,
          fw:99
        },
        "BK Pataca":{
          p:263.34,
          fw:99
        },
        "BK Grivnia":{
          p:269.94,
          fw:99
        }
      },
      "Painel Romano":{
        "BK Pinpoint":{
          p:190.8,
          fw:99
        },
        "BK Euro":{
          p:214.37,
          fw:99
        },
        "BK Napole":{
          p:215.48,
          fw:99
        },
        "BK Etherium":{
          p:224.77,
          fw:99
        },
        "BK Manat":{
          p:234.75,
          fw:99
        },
        "BK Cardano":{
          p:238.17,
          fw:99
        },
        "BK Iene":{
          p:243.79,
          fw:99
        },
        "BK Quiate":{
          p:267.5,
          fw:99
        },
        "BK Yuan":{
          p:268.84,
          fw:99
        },
        "BK Pataca":{
          p:311.22,
          fw:99
        },
        "BK Grivnia":{
          p:319.02,
          fw:99
        }
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|FILTRA-SOL":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.6,
    maxLarg:4.0,
    maxAlt:3.0,
    maxM2:15.5,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Transpasse padrão 8cm; acima +10% | Prazo: 5 dias úteis"
    ],
    subCols:{
      "Painel Europa":{
        "Screen 5% Fit":{
          p:138.46,
          fw:99
        },
        "Screen 5%":{
          p:151.41,
          fw:99
        },
        "Screen 3%":{
          p:160.43,
          fw:99
        },
        "Screen 1%":{
          p:179.34,
          fw:99
        },
        "Screen 5% Especial":{
          p:223.21,
          fw:99
        }
      },
      "Painel Romano":{
        "Screen 5% Fit":{
          p:163.63,
          fw:99
        },
        "Screen 5%":{
          p:178.94,
          fw:99
        },
        "Screen 3%":{
          p:189.6,
          fw:99
        },
        "Screen 1%":{
          p:211.95,
          fw:99
        },
        "Screen 5% Especial":{
          p:263.8,
          fw:99
        }
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|TRANSLÚCIDA":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.6,
    maxLarg:4.0,
    maxAlt:3.0,
    maxM2:15.5,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Prazo: 5 dias úteis"
    ],
    subCols:{
      "Painel Europa":{
        "Napole Luz":{
          p:135.85,
          fw:99
        },
        "Euro Translúcido":{
          p:143.0,
          fw:99
        },
        "Yuan Translúcido":{
          p:145.53,
          fw:99
        },
        Kina:{
          p:149.52,
          fw:99
        },
        Metical:{
          p:155.31,
          fw:99
        },
        "Quiate Luz":{
          p:159.44,
          fw:99
        }
      },
      "Painel Romano":{
        "Napole Luz":{
          p:160.55,
          fw:99
        },
        "Euro Translúcido":{
          p:169.0,
          fw:99
        },
        "Yuan Translúcido":{
          p:171.99,
          fw:99
        },
        Kina:{
          p:176.71,
          fw:99
        },
        Metical:{
          p:183.55,
          fw:99
        },
        "Quiate Luz":{
          p:188.42,
          fw:99
        }
      }
    }
  },
  "CORTINAS|CORTINA ELEGANCE / DOUBLE VISION|TRANSLÚCIDA":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:3.0,
    maxAlt:3.0,
    maxM2:6.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Padrão: Barra Estabilizadora inclusa; bandô cobrado à parte",
      "Sem suporte de junção/intermediário | Sempre corrente contínua",
      "Lâminas podem não fechar totalmente | Prazo: 5 dias úteis"
    ],
    cols:{
      Basic:{
        p:229.03,
        fw:2.15
      },
      Stile:{
        p:261.72,
        fw:3.0
      },
      Shadow:{
        p:265.15,
        fw:3.0
      }
    }
  },
  "CORTINAS|CORTINA ELEGANCE / DOUBLE VISION|SEMI BLACKOUT":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:3.0,
    maxAlt:3.0,
    maxM2:6.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Bandô incluso | Sem suporte de junção/intermediário | Prazo: 5 dias úteis"
    ],
    cols:{
      "Semi Blackout":{
        p:322.79,
        fw:3.0
      }
    }
  },
  "CORTINAS|CORTINA NUETTE|TECIDO":{
    minM2:1.2,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:3.0,
    maxAlt:3.0,
    maxM2:6.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Bandô incluso | Sem suporte de junção/intermediário | Com redução de peso: corrente contínua | Prazo: 5 dias úteis"
    ],
    cols:{
      Basic:{
        p:452.07,
        fw:2.6
      }
    }
  },
  "CORTINAS|CORTINA CELULAR|TRANSLÚCIDA":{
    minM2:1.5,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:3.0,
    maxAlt:3.5,
    maxM2:10.0,
    tipoImp:"celular",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Larg máx: 3,00m | Alt máx: 3,50m (motorizada) | Prazo: 5 dias úteis"
    ],
    cols:{
      Luna:{
        p:442.18,
        fw:99
      }
    }
  },
  "CORTINAS|CORTINA CELULAR|BLACKOUT":{
    minM2:1.5,
    minAlt:1.0,
    minFab:0.6,
    maxLarg:3.0,
    maxAlt:3.5,
    maxM2:10.0,
    tipoImp:"celular",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Prazo: 5 dias úteis"
    ],
    cols:{
      "BK Cocoon":{
        p:611.51,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|TRANSLÚCIDA":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.4,
    maxLarg:4.0,
    maxAlt:3.5,
    maxM2:12.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Larg máx: 4,00m | Alt máx: 3,50m | Prazo: 5 dias úteis"
    ],
    cols:{
      Miami:{
        p:106.76,
        fw:99
      },
      "Nova Paris":{
        p:113.45,
        fw:99
      },
      Caprice:{
        p:134.51,
        fw:99
      },
      Letras:{
        p:139.44,
        fw:99
      },
      Córdoba:{
        p:151.44,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|FILTRA-SOL":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.4,
    maxLarg:4.0,
    maxAlt:3.5,
    maxM2:12.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Prazo: 5 dias úteis"
    ],
    cols:{
      "Filtra Sol 5%":{
        p:140.0,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|BLACKOUT":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.4,
    maxLarg:4.0,
    maxAlt:3.5,
    maxM2:12.0,
    tipoImp:"tecido",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Trilho prata = padrão; trilho ouro/branco = +R$5,62/ml | Prazo: 5 dias úteis"
    ],
    cols:{
      "BK Califórnia":{
        p:152.29,
        fw:99
      },
      "BK Pinpoint":{
        p:160.0,
        fw:99
      },
      "BK Napole":{
        p:170.0,
        fw:99
      },
      "BK New Líbia":{
        p:172.46,
        fw:99
      },
      "BK Lempira":{
        p:181.08,
        fw:99
      },
      "BK Libra":{
        p:180.74,
        fw:99
      },
      "BK Tala":{
        p:184.8,
        fw:99
      },
      "BK Kipe":{
        p:189.21,
        fw:99
      },
      "BK França":{
        p:193.52,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|PVC":{
    minM2:1.5,
    minAlt:1.5,
    minFab:0.4,
    maxLarg:4.0,
    maxAlt:3.5,
    maxM2:12.0,
    tipoImp:"pvc",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,50 m² | Conjunto de lâminas avulso: 80% do valor da persiana completa | Prazo: 5 dias úteis"
    ],
    cols:{
      "Básico (Br/Ivory/Tan/Gelo)":{
        p:147.98,
        fw:99
      },
      Opaco:{
        p:160.08,
        fw:99
      },
      Arizona:{
        p:190.76,
        fw:99
      },
      Gurde:{
        p:206.42,
        fw:99
      },
      Rand:{
        p:220.0,
        fw:99
      },
      Lira:{
        p:253.0,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|16MM":{
    minM2:1.0,
    minAlt:1.0,
    minFab:0.4,
    maxLarg:2.65,
    maxAlt:3.0,
    maxM2:5.0,
    tipoImp:"aluminio",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,00 m² | Larg máx: 2,65m | Prazo: 5 dias úteis"
    ],
    cols:{
      Básico:{
        p:207.24,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|25MM":{
    minM2:1.0,
    minAlt:1.0,
    minFab:0.4,
    maxLarg:2.65,
    maxAlt:3.0,
    maxM2:5.0,
    tipoImp:"aluminio",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,00 m² | Larg máx: 2,65m | Prazo: 5 dias úteis"
    ],
    cols:{
      "Básico Normal":{
        p:129.66,
        fw:99
      },
      "Básico Privacy":{
        p:142.62,
        fw:99
      },
      "Básico Color Normal":{
        p:132.72,
        fw:99
      },
      "Básico Color Privacy":{
        p:146.0,
        fw:99
      },
      Perfurado:{
        p:169.49,
        fw:99
      },
      "Duplex Normal":{
        p:187.0,
        fw:99
      },
      "Duplex Privacy":{
        p:205.7,
        fw:99
      },
      "Listrado Normal":{
        p:198.0,
        fw:99
      },
      "Listrado Privacy":{
        p:217.8,
        fw:99
      },
      "Carvalho Normal":{
        p:231.0,
        fw:99
      },
      "Carvalho Privacy":{
        p:254.1,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|50MM — ALUMÍNIO":{
    minM2:1.2,
    minAlt:1.0,
    maxLarg:2.6,
    maxAlt:3.5,
    maxM2:8.0,
    tipoImp:"aluminio",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Larg máx: 2,60m",
      "Monocontrole obrigatório após limite de m² (R$140,40) | Prazo: 5 dias úteis"
    ],
    cols:{
      "Alumínio Básico c/ Cadarço":{
        p:246.75,
        fw:99
      },
      "Alumínio Básico c/ Fita":{
        p:271.43,
        fw:99
      },
      "Alumínio Perfurado c/ Cadarço":{
        p:281.6,
        fw:99
      },
      "Alumínio Perfurado c/ Fita":{
        p:309.76,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|50MM — PVC":{
    minM2:1.2,
    minAlt:1.0,
    maxLarg:2.4,
    maxAlt:3.0,
    maxM2:6.0,
    tipoImp:"pvc",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Larg máx: 2,40m | Prazo: 5 dias úteis"
    ],
    cols:{
      "PVC Curve c/ Cadarço":{
        p:322.22,
        fw:99
      },
      "PVC Curve c/ Fita":{
        p:354.44,
        fw:99
      },
      "PVC Rustic c/ Cadarço":{
        p:365.18,
        fw:99
      },
      "PVC Rustic c/ Fita":{
        p:401.7,
        fw:99
      },
      "PVC Vintage c/ Cadarço":{
        p:378.75,
        fw:99
      },
      "PVC Vintage c/ Fita":{
        p:416.62,
        fw:99
      },
      "PVC Novobright c/ Cadarço":{
        p:427.36,
        fw:99
      },
      "PVC Novobright c/ Fita":{
        p:470.1,
        fw:99
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|50MM — MADEIRA / BAMBU":{
    minM2:1.2,
    minAlt:1.0,
    maxLarg:2.4,
    maxAlt:3.0,
    maxM2:3.5,
    tipoImp:"madeira",
    isPromo:false,
    obs:[
      "Cobrança mínima: 1,20 m² | Larg máx: 2,40m | Sem incidência de impostos | Prazo: 5 dias úteis"
    ],
    cols:{
      "Bambu c/ Cadarço":{
        p:530.89,
        fw:99
      },
      "Bambu c/ Fita":{
        p:583.98,
        fw:99
      },
      "Bamboo Eco c/ Cadarço":{
        p:530.89,
        fw:99
      },
      "Bamboo Eco c/ Fita":{
        p:583.98,
        fw:99
      },
      "Madeira Sintética c/ Cadarço":{
        p:544.5,
        fw:99
      },
      "Madeira Sintética c/ Fita":{
        p:598.95,
        fw:99
      }
    }
  }
};

// Tabela Decore — Outubro/2026 (vigência 01/10/2026). Sem tabela promocional: 12%+3% em todos os itens.
const DB_DECORE = {
  "CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA": {
    "minM2": 1.2,
    "minAlt": 1,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Observar largura máxima de cada tecido",
      "Acessórios cinza/bege: +7% | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Delta": {
        "p": 95.51,
        "fw": 2,
        "promo": false
      },
      "Monaco Luz": {
        "p": 103.36,
        "fw": 2.5,
        "promo": false
      },
      "Fustão Luz": {
        "p": 111.97,
        "fw": 2,
        "promo": false
      },
      "Lugano Luz": {
        "p": 107.25,
        "fw": 3,
        "promo": false
      },
      "Odin Luz": {
        "p": 110.99,
        "fw": 1.4,
        "promo": false
      },
      "Carlota": {
        "p": 112.33,
        "fw": 2,
        "promo": false
      },
      "Atlas": {
        "p": 119.94,
        "fw": 2,
        "promo": false
      },
      "Book": {
        "p": 113.97,
        "fw": 2,
        "promo": false
      },
      "Linho Misto": {
        "p": 118.83,
        "fw": 2,
        "promo": false
      },
      "Maia": {
        "p": 116.5,
        "fw": 2,
        "promo": false
      },
      "Napoles Luz": {
        "p": 122.52,
        "fw": 2.4,
        "promo": false
      },
      "Inca Luz": {
        "p": 123.41,
        "fw": 2,
        "promo": false
      },
      "Laus": {
        "p": 136.44,
        "fw": 2,
        "promo": false
      },
      "Rustico Luz": {
        "p": 111.84,
        "fw": 3,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ROLÔ|FILTRA-SOL": {
    "minM2": 1.2,
    "minAlt": 1,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Redução de peso automática: larg >1,80m OU alt >2,00m (R$75) | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Hydra 5%": {
        "p": 121.44,
        "fw": 3,
        "promo": false
      },
      "Malta 3%": {
        "p": 126.68,
        "fw": 3,
        "promo": false
      },
      "Betis 1%": {
        "p": 142.94,
        "fw": 3,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ROLÔ|BLACKOUT": {
    "minM2": 1.2,
    "minAlt": 1,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Observar largura máxima de cada tecido",
      "Redução de peso automática: larg >1,80m OU alt >2,00m (R$75/cortina, sem desconto)",
      "Junção: R$20 | Acessórios cinza/bege: +7% | Prazo: 5 dias úteis"
    ],
    "cols": {
      "BK Berlim": {
        "p": 120.32,
        "fw": 2.5,
        "promo": false
      },
      "BK Pinpoint Soft": {
        "p": 118.68,
        "fw": 3,
        "promo": false
      },
      "BK Pinpoint Flex": {
        "p": 131.72,
        "fw": 3,
        "promo": false
      },
      "BK Libia": {
        "p": 128.39,
        "fw": 2.2,
        "promo": false
      },
      "BK Pinpoint Plus": {
        "p": 140.11,
        "fw": 3,
        "promo": false
      },
      "BK Odin": {
        "p": 146.64,
        "fw": 1.4,
        "promo": false
      },
      "BK Monaco": {
        "p": 142.47,
        "fw": 3,
        "promo": false
      },
      "BK Madri": {
        "p": 147.18,
        "fw": 3,
        "promo": false
      },
      "BK Lugano": {
        "p": 148.06,
        "fw": 3,
        "promo": false
      },
      "BK Napoles": {
        "p": 150.26,
        "fw": 2.4,
        "promo": false
      },
      "BK Lins": {
        "p": 161.05,
        "fw": 2.8,
        "promo": false
      },
      "BK Manari": {
        "p": 154.53,
        "fw": 3,
        "promo": false
      },
      "BK Elise": {
        "p": 161.82,
        "fw": 2,
        "promo": false
      },
      "BK Fustão": {
        "p": 176.19,
        "fw": 2.8,
        "promo": false
      },
      "BK Aurea": {
        "p": 152.71,
        "fw": 2.4,
        "promo": false
      },
      "BK Inca": {
        "p": 178.87,
        "fw": 2,
        "promo": false
      },
      "BK Viena": {
        "p": 179.65,
        "fw": 2.8,
        "promo": false
      },
      "BK Prestige": {
        "p": 194.63,
        "fw": 2.8,
        "promo": false
      },
      "BK Rustico": {
        "p": 154.25,
        "fw": 3,
        "promo": false
      },
      "BK Screen": {
        "p": 143.64,
        "fw": 3,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ROMANA|TRANSLÚCIDA": {
    "minM2": 1.2,
    "minAlt": 1,
    "maxLarg": 2.8,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg máx: 2,80m | Acessórios cinza/bege: +7% | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Delta": {
        "p": 153.18,
        "fw": 99,
        "promo": false
      },
      "Fustão Luz": {
        "p": 168.73,
        "fw": 99,
        "promo": false
      },
      "Lugano Luz": {
        "p": 168.54,
        "fw": 99,
        "promo": false
      },
      "Carlota": {
        "p": 169.07,
        "fw": 99,
        "promo": false
      },
      "Atlas": {
        "p": 176.25,
        "fw": 99,
        "promo": false
      },
      "Book": {
        "p": 170.62,
        "fw": 99,
        "promo": false
      },
      "Linho Misto": {
        "p": 175.2,
        "fw": 99,
        "promo": false
      },
      "Maia": {
        "p": 173,
        "fw": 99,
        "promo": false
      },
      "Napoles Luz": {
        "p": 188.73,
        "fw": 99,
        "promo": false
      },
      "Inca Luz": {
        "p": 179.53,
        "fw": 99,
        "promo": false
      },
      "Laus": {
        "p": 191.84,
        "fw": 99,
        "promo": false
      },
      "Rustico Luz": {
        "p": 172.88,
        "fw": 99,
        "promo": false
      },
      "Monaco Luz": {
        "p": 164.87,
        "fw": 99,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ROMANA|FILTRA-SOL": {
    "minM2": 1.2,
    "minAlt": 1,
    "maxLarg": 2.8,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg máx: 2,80m | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Hydra 5%": {
        "p": 181.94,
        "fw": 99,
        "promo": false
      },
      "Malta 3%": {
        "p": 186.89,
        "fw": 99,
        "promo": false
      },
      "Betis 1%": {
        "p": 202.24,
        "fw": 99,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ROMANA|BLACKOUT": {
    "minM2": 1.2,
    "minAlt": 1,
    "maxLarg": 2.8,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg máx: 2,80m | Prazo: 5 dias úteis"
    ],
    "cols": {
      "BK Berlim": {
        "p": 180.89,
        "fw": 99,
        "promo": false
      },
      "BK Pinpoint Flex": {
        "p": 191.65,
        "fw": 99,
        "promo": false
      },
      "BK Libia": {
        "p": 184.23,
        "fw": 99,
        "promo": false
      },
      "BK Monaco": {
        "p": 201.8,
        "fw": 99,
        "promo": false
      },
      "BK Lugano": {
        "p": 207.08,
        "fw": 99,
        "promo": false
      },
      "BK Napoles": {
        "p": 209.16,
        "fw": 99,
        "promo": false
      },
      "BK Lins": {
        "p": 215.08,
        "fw": 99,
        "promo": false
      },
      "BK Manari": {
        "p": 213.19,
        "fw": 99,
        "promo": false
      },
      "BK Elise": {
        "p": 215.81,
        "fw": 99,
        "promo": false
      },
      "BK Fustão": {
        "p": 229.38,
        "fw": 99,
        "promo": false
      },
      "BK Aurea": {
        "p": 207.2,
        "fw": 99,
        "promo": false
      },
      "BK Inca": {
        "p": 231.9,
        "fw": 99,
        "promo": false
      },
      "BK Viena": {
        "p": 236.92,
        "fw": 99,
        "promo": false
      },
      "BK Rustico": {
        "p": 212.92,
        "fw": 99,
        "promo": false
      },
      "BK Screen": {
        "p": 202.91,
        "fw": 99,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|TRANSLÚCIDA": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxAlt": 4.5,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Alt máx: 4,50m | Bandô cobrado separadamente | Prazo: 5 dias úteis"
    ],
    "subCols": {
      "Painel Manual": {
        "Delta": {
          "p": 127.03,
          "fw": 99,
          "promo": false
        },
        "Fustão Luz": {
          "p": 146.22,
          "fw": 99,
          "promo": false
        },
        "Lugano Luz": {
          "p": 143.01,
          "fw": 99,
          "promo": false
        },
        "Odin Luz": {
          "p": 175.02,
          "fw": 99,
          "promo": false
        },
        "Carlota": {
          "p": 146.64,
          "fw": 99,
          "promo": false
        },
        "Atlas": {
          "p": 155.51,
          "fw": 99,
          "promo": false
        },
        "Book": {
          "p": 148.55,
          "fw": 99,
          "promo": false
        },
        "Linho Misto": {
          "p": 154.21,
          "fw": 99,
          "promo": false
        },
        "Maia": {
          "p": 151.5,
          "fw": 99,
          "promo": false
        },
        "Napoles Luz": {
          "p": 153.76,
          "fw": 99,
          "promo": false
        },
        "Inca Luz": {
          "p": 159.56,
          "fw": 99,
          "promo": false
        },
        "Laus": {
          "p": 174.75,
          "fw": 99,
          "promo": false
        },
        "Rustico Luz": {
          "p": 148.4,
          "fw": 99,
          "promo": false
        },
        "Monaco Luz": {
          "p": 138.44,
          "fw": 99,
          "promo": false
        }
      },
      "Painel Romano Manual": {
        "Delta": {
          "p": 152.43,
          "fw": 99,
          "promo": false
        },
        "Fustão Luz": {
          "p": 175.46,
          "fw": 99,
          "promo": false
        },
        "Lugano Luz": {
          "p": 171.61,
          "fw": 99,
          "promo": false
        },
        "Carlota": {
          "p": 175.97,
          "fw": 99,
          "promo": false
        },
        "Atlas": {
          "p": 186.61,
          "fw": 99,
          "promo": false
        },
        "Book": {
          "p": 178.26,
          "fw": 99,
          "promo": false
        },
        "Linho Misto": {
          "p": 185.05,
          "fw": 99,
          "promo": false
        },
        "Maia": {
          "p": 181.8,
          "fw": 99,
          "promo": false
        },
        "Napoles Luz": {
          "p": 184.51,
          "fw": 99,
          "promo": false
        },
        "Inca Luz": {
          "p": 191.47,
          "fw": 99,
          "promo": false
        },
        "Laus": {
          "p": 209.7,
          "fw": 99,
          "promo": false
        },
        "Rustico Luz": {
          "p": 178.08,
          "fw": 99,
          "promo": false
        },
        "Monaco Luz": {
          "p": 166.13,
          "fw": 99,
          "promo": false
        }
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|FILTRA-SOL": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxAlt": 4.5,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Alt máx: 4,50m | Bandô cobrado separadamente | Prazo: 5 dias úteis"
    ],
    "subCols": {
      "Painel Manual": {
        "Hydra 5%": {
          "p": 159.67,
          "fw": 99,
          "promo": false
        },
        "Malta 3%": {
          "p": 165.83,
          "fw": 99,
          "promo": false
        },
        "Betis 1%": {
          "p": 184.92,
          "fw": 99,
          "promo": false
        }
      },
      "Painel Romano Manual": {
        "Hydra 5%": {
          "p": 191.6,
          "fw": 99,
          "promo": false
        },
        "Malta 3%": {
          "p": 199,
          "fw": 99,
          "promo": false
        },
        "Betis 1%": {
          "p": 221.9,
          "fw": 99,
          "promo": false
        }
      }
    }
  },
  "CORTINAS|CORTINA PAINEL|BLACKOUT": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxAlt": 4.5,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Alt máx: 4,50m | Bandô cobrado separadamente",
      "Largura da folha: 0,50-0,85m | Transpasse 8-10cm | Prazo: 5 dias úteis"
    ],
    "subCols": {
      "Painel Manual": {
        "BK Berlim": {
          "p": 158.36,
          "fw": 99,
          "promo": false
        },
        "BK Pinpoint Soft": {
          "p": 154.04,
          "fw": 99,
          "promo": false
        },
        "BK Pinpoint Flex": {
          "p": 171.74,
          "fw": 99,
          "promo": false
        },
        "BK Libia": {
          "p": 161.07,
          "fw": 99,
          "promo": false
        },
        "BK Pinpoint Plus": {
          "p": 166.46,
          "fw": 99,
          "promo": false
        },
        "BK Odin": {
          "p": 234.41,
          "fw": 99,
          "promo": false
        },
        "BK Monaco": {
          "p": 184.36,
          "fw": 99,
          "promo": false
        },
        "BK Madri": {
          "p": 189.89,
          "fw": 99,
          "promo": false
        },
        "BK Lugano": {
          "p": 185.75,
          "fw": 99,
          "promo": false
        },
        "BK Napoles": {
          "p": 192.14,
          "fw": 99,
          "promo": false
        },
        "BK Lins": {
          "p": 203.45,
          "fw": 99,
          "promo": false
        },
        "BK Manari": {
          "p": 198.52,
          "fw": 99,
          "promo": false
        },
        "BK Elise": {
          "p": 204.35,
          "fw": 99,
          "promo": false
        },
        "BK Fustão": {
          "p": 221.1,
          "fw": 99,
          "promo": false
        },
        "BK Aurea": {
          "p": 182.94,
          "fw": 99,
          "promo": false
        },
        "BK Inca": {
          "p": 224.22,
          "fw": 99,
          "promo": false
        },
        "BK Viena": {
          "p": 228.03,
          "fw": 99,
          "promo": false
        },
        "BK Prestige": {
          "p": 218.35,
          "fw": 99,
          "promo": false
        },
        "BK Rustico": {
          "p": 198.19,
          "fw": 99,
          "promo": false
        },
        "BK Screen": {
          "p": 185.75,
          "fw": 99,
          "promo": false
        }
      },
      "Painel Romano Manual": {
        "BK Berlim": {
          "p": 190.03,
          "fw": 99,
          "promo": false
        },
        "BK Pinpoint Flex": {
          "p": 206.09,
          "fw": 99,
          "promo": false
        },
        "BK Libia": {
          "p": 193.28,
          "fw": 99,
          "promo": false
        },
        "BK Monaco": {
          "p": 221.23,
          "fw": 99,
          "promo": false
        },
        "BK Lugano": {
          "p": 222.89,
          "fw": 99,
          "promo": false
        },
        "BK Napoles": {
          "p": 230.57,
          "fw": 99,
          "promo": false
        },
        "BK Lins": {
          "p": 244.13,
          "fw": 99,
          "promo": false
        },
        "BK Manari": {
          "p": 238.23,
          "fw": 99,
          "promo": false
        },
        "BK Elise": {
          "p": 245.22,
          "fw": 99,
          "promo": false
        },
        "BK Fustão": {
          "p": 265.32,
          "fw": 99,
          "promo": false
        },
        "BK Aurea": {
          "p": 219.53,
          "fw": 99,
          "promo": false
        },
        "BK Inca": {
          "p": 269.07,
          "fw": 99,
          "promo": false
        },
        "BK Viena": {
          "p": 273.64,
          "fw": 99,
          "promo": false
        },
        "BK Rustico": {
          "p": 237.83,
          "fw": 99,
          "promo": false
        },
        "BK Screen": {
          "p": 222.89,
          "fw": 99,
          "promo": false
        }
      }
    }
  },
  "CORTINAS|CORTINA ELEGANCE / DOUBLE VISION|TRANSLÚCIDA": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxLarg": 3,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Largura mínima: 1,00m | Altura mínima: 1,50m",
      "Bandô cobrado separadamente | Prazo: 5 dias úteis",
      "Acessórios cinza/bege: +5% | Comando redutor: R$75 (sem desconto)"
    ],
    "cols": {
      "Opala": {
        "p": 217.41,
        "fw": 3,
        "promo": false
      },
      "Jade": {
        "p": 294.05,
        "fw": 2.25,
        "promo": false
      },
      "Babel": {
        "p": 294.05,
        "fw": 2.25,
        "promo": false
      },
      "Diamante": {
        "p": 247.71,
        "fw": 3,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA ELEGANCE / DOUBLE VISION|SEMI BLACKOUT": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxLarg": 3,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Bandô cobrado separadamente | Prazo: 5 dias úteis",
      "Acessórios cinza/bege: +5% | Comando redutor: R$75 (sem desconto)"
    ],
    "cols": {
      "Topázio SBK": {
        "p": 308.31,
        "fw": 3,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA CELULAR|TRANSLÚCIDA": {
    "minM2": 1.2,
    "minAlt": 1,
    "minLarg": 0.4,
    "maxLarg": 3.5,
    "maxAlt": 3,
    "tipoImp": "celular",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg mín: 0,40m | Larg máx: 3,50m | Alt máx: 3,00m | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Translúcido 25mm": {
        "p": 389.53,
        "fw": 99,
        "promo": false
      },
      "Translúcido 38mm": {
        "p": 393.97,
        "fw": 99,
        "promo": false
      }
    }
  },
  "CORTINAS|CORTINA CELULAR|BLACKOUT": {
    "minM2": 1.2,
    "minAlt": 1,
    "minLarg": 0.4,
    "maxLarg": 3.5,
    "maxAlt": 3,
    "tipoImp": "celular",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Prazo: 5 dias úteis"
    ],
    "cols": {
      "Blackout 25mm": {
        "p": 522.1,
        "fw": 99,
        "promo": false
      },
      "Blackout 38mm": {
        "p": 545.96,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|TRANSLÚCIDA": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxLarg": 3.8,
    "maxAlt": 4,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Larg mín: 0,30m | Larg máx: 3,80m | Alt máx: 4,00m | Prazo: 3 dias úteis"
    ],
    "cols": {
      "Nuance": {
        "p": 99.08,
        "fw": 99,
        "promo": false
      },
      "Paris": {
        "p": 104.76,
        "fw": 99,
        "promo": false
      },
      "Nantes": {
        "p": 109.01,
        "fw": 99,
        "promo": false
      },
      "Monaco Luz": {
        "p": 104.28,
        "fw": 99,
        "promo": false
      },
      "Delta": {
        "p": 104.38,
        "fw": 99,
        "promo": false
      },
      "Atlas": {
        "p": 128.44,
        "fw": 99,
        "promo": false
      },
      "Fustão Luz": {
        "p": 120.59,
        "fw": 99,
        "promo": false
      },
      "Lugano Luz": {
        "p": 107.81,
        "fw": 99,
        "promo": false
      },
      "Linho Misto": {
        "p": 127.35,
        "fw": 99,
        "promo": false
      },
      "Napoles Luz": {
        "p": 116.14,
        "fw": 99,
        "promo": false
      },
      "Book": {
        "p": 122.57,
        "fw": 99,
        "promo": false
      },
      "Maia": {
        "p": 125.05,
        "fw": 99,
        "promo": false
      },
      "Letrinhas Kids": {
        "p": 132.15,
        "fw": 99,
        "promo": false
      },
      "Novo Arezzo Luz": {
        "p": 148.95,
        "fw": 99,
        "promo": false
      },
      "Odin Luz": {
        "p": 144.93,
        "fw": 99,
        "promo": false
      },
      "Rustico Luz": {
        "p": 111.99,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|FILTRA-SOL": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxLarg": 3.8,
    "maxAlt": 4,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Prazo: 3 dias úteis"
    ],
    "cols": {
      "Hydra 5%": {
        "p": 120.71,
        "fw": 99,
        "promo": false
      },
      "Malta 3%": {
        "p": 125.49,
        "fw": 99,
        "promo": false
      },
      "Betis 1%": {
        "p": 140.27,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|BLACKOUT": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "maxLarg": 3.8,
    "maxAlt": 4,
    "tipoImp": "tecido",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Prazo: 3 dias úteis"
    ],
    "cols": {
      "BK Berlim": {
        "p": 119.7,
        "fw": 99,
        "promo": false
      },
      "BK Pinpoint Soft": {
        "p": 127.2,
        "fw": 99,
        "promo": false
      },
      "BK Lins": {
        "p": 168.94,
        "fw": 99,
        "promo": false
      },
      "BK Pinpoint Flex": {
        "p": 132.23,
        "fw": 99,
        "promo": false
      },
      "BK Libia": {
        "p": 133.14,
        "fw": 99,
        "promo": false
      },
      "BK Monaco": {
        "p": 139.84,
        "fw": 99,
        "promo": false
      },
      "BK Lugano": {
        "p": 140.91,
        "fw": 99,
        "promo": false
      },
      "BK Soleil": {
        "p": 144.13,
        "fw": 99,
        "promo": false
      },
      "BK Madri": {
        "p": 164.98,
        "fw": 99,
        "promo": false
      },
      "BK Fustão": {
        "p": 183.86,
        "fw": 99,
        "promo": false
      },
      "BK Napoles": {
        "p": 145.87,
        "fw": 99,
        "promo": false
      },
      "BK Manari": {
        "p": 150.81,
        "fw": 99,
        "promo": false
      },
      "BK Aurea": {
        "p": 151.62,
        "fw": 99,
        "promo": false
      },
      "BK Tokio": {
        "p": 192.79,
        "fw": 99,
        "promo": false
      },
      "BK Prestige": {
        "p": 166.16,
        "fw": 99,
        "promo": false
      },
      "BK Odin": {
        "p": 195.11,
        "fw": 99,
        "promo": false
      },
      "BK Juta": {
        "p": 196.68,
        "fw": 99,
        "promo": false
      },
      "BK Salta": {
        "p": 202.69,
        "fw": 99,
        "promo": false
      },
      "BK Viena": {
        "p": 173.66,
        "fw": 99,
        "promo": false
      },
      "BK Novo Arezzo": {
        "p": 210.47,
        "fw": 99,
        "promo": false
      },
      "BK Rustico": {
        "p": 150.55,
        "fw": 99,
        "promo": false
      },
      "BK Screen": {
        "p": 140.91,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA VERTICAL|PVC": {
    "minM2": 1.5,
    "minAlt": 1.5,
    "minLarg": 0.3,
    "maxLarg": 3.8,
    "maxAlt": 4,
    "tipoImp": "pvc",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,50 m² | Larg mín: 0,30m | Studio S: sem corrente de base",
      "IPI 3,25% NÃO incluso — será somado ao calcular | Prazo: 3 dias úteis"
    ],
    "cols": {
      "Pvc Slim": {
        "p": 132.11,
        "fw": 99,
        "promo": false
      },
      "Pvc Basic (Br/Be/Camurça/Cinza)": {
        "p": 148.36,
        "fw": 99,
        "promo": false
      },
      "Pvc Basic Demais Cores": {
        "p": 155.65,
        "fw": 99,
        "promo": false
      },
      "Pvc Arizona": {
        "p": 195.92,
        "fw": 99,
        "promo": false
      },
      "Pvc Rustic": {
        "p": 181.28,
        "fw": 99,
        "promo": false
      },
      "Pvc Studio": {
        "p": 202.01,
        "fw": 99,
        "promo": false
      },
      "Pvc Vintage": {
        "p": 208.02,
        "fw": 99,
        "promo": false
      },
      "Pvc Regatta": {
        "p": 219.24,
        "fw": 99,
        "promo": false
      },
      "Pvc Thay": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      },
      "Pvc Juta": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      },
      "Pvc Patina": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      },
      "Pvc Office": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      },
      "Pvc Frost": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      },
      "Pvc Studio S": {
        "p": 166.82,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|16MM": {
    "minM2": 1,
    "minAlt": 1,
    "minLarg": 0.3,
    "maxLarg": 2.5,
    "maxAlt": 4,
    "tipoImp": "aluminio",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,00 m² | Larg mín: 0,30m | Larg máx: 2,50m",
      "IPI 3,25% NÃO incluso — será somado | Prazo: 5 dias úteis"
    ],
    "cols": {
      "16mm Lisa (cores promo: Br/Pt/Gelo/Areia/Inox/Gold)": {
        "p": 117.13,
        "fw": 99,
        "promo": false
      },
      "16mm Lisa Demais Cores": {
        "p": 119.64,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|25MM": {
    "minM2": 1,
    "minAlt": 1,
    "minLarg": 0.3,
    "maxLarg": 2.5,
    "maxAlt": 4,
    "tipoImp": "aluminio",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,00 m² | Larg mín: 0,30m | Larg máx: 2,50m",
      "IPI 3,25% NÃO incluso — será somado | Prazo: 5 dias úteis",
      "Duplex/triplex: cada parte = 1 persiana; 3 cores: +20%"
    ],
    "cols": {
      "25mm Lisa (cores promo)": {
        "p": 117.13,
        "fw": 99,
        "promo": false
      },
      "25mm Lisa Demais Cores": {
        "p": 119.64,
        "fw": 99,
        "promo": false
      },
      "25mm Semi-BK": {
        "p": 131.6,
        "fw": 99,
        "promo": false
      },
      "25mm Perfurada": {
        "p": 148.94,
        "fw": 99,
        "promo": false
      },
      "25mm Decorada": {
        "p": 145.66,
        "fw": 99,
        "promo": false
      },
      "25mm Decorada Semi-BK": {
        "p": 160.23,
        "fw": 99,
        "promo": false
      }
    }
  },
  "PERSIANAS|PERSIANA HORIZONTAL|50MM — ALUMÍNIO": {
    "minM2": 1.2,
    "minAlt": 1,
    "maxLarg": 2.5,
    "maxAlt": 4,
    "tipoImp": "aluminio",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg mín: 0,50m | Larg máx: 2,50m",
      "IPI 3,25% NÃO incluso — será somado | Monocomando: R$120 (sem desconto) | Prazo: 5 dias úteis"
    ],
    "cols": {
      "50mm Lisa c/ Cadarço": {
        "p": 222.48,
        "fw": 99,
        "promo": false
      },
      "50mm Lisa c/ Fita": {
        "p": 260.3,
        "fw": 99,
        "promo": false
      },
      "50mm Perfurada c/ Cadarço": {
        "p": 237.87,
        "fw": 99,
        "promo": false
      },
      "50mm Perfurada c/ Fita": {
        "p": 278.31,
        "fw": 99,
        "promo": false
      },
      "50mm Decorada c/ Cadarço": {
        "p": 245.57,
        "fw": 99,
        "promo": false
      },
      "50mm Decorada c/ Fita": {
        "p": 287.32,
        "fw": 99,
        "promo": false
      }
    },
    "minLarg": 0.5
  },
  "PERSIANAS|PERSIANA HORIZONTAL|50MM — MADEIRA / BAMBU": {
    "minM2": 1.2,
    "minAlt": 1,
    "maxLarg": 2.4,
    "maxAlt": 2.5,
    "tipoImp": "madeira",
    "isPromo": false,
    "obs": [
      "Cobrança mínima: 1,20 m² | Larg mín: 0,30m | Larg máx: 2,40m | Alt máx: 2,50m | Monocomando incluso | Sem impostos | Prazo: 5 dias úteis"
    ],
    "cols": {
      "50mm Madeira c/ Cadarço (Mono incl.)": {
        "p": 517.32,
        "fw": 99,
        "promo": false
      },
      "50mm Madeira c/ Fita (Mono incl.)": {
        "p": 553.54,
        "fw": 99,
        "promo": false
      }
    }
  }
};


// ACESSÓRIOS — organizados por seção
// unit: "und" | "ml-larg" | "ml-alt"
// compat: array de produtos que o acessório atende
// cor: {W:preco_branco, C:preco_cor, WP:preco_branco_preto} (se houver diferença)

const ACC_REAL = [
  {
    sec:"Bandô",
    items:[
      {id:"r_bs",  l:"Bandô Rolô Standard",        unit:"ml-larg", cor:{W:92.42,C:101.67},  maxLarg:99,  note:"Compatível: Tubo 32mm, 40mm, 55mm",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_bb32",l:"Bandô Box 32",                unit:"ml-larg", cor:{W:163.63,C:179.99}, maxLarg:1.80,note:"Larg máx: 1,80m | Branco ou Preto",
       compat:["CORTINA ROLÔ"]},
      {id:"r_bb40",l:"Bandô Box 40",                unit:"ml-larg", cor:{W:216.46,C:238.10}, maxLarg:2.40,note:"Compatível: Tubo 40mm, 55mm",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_bsol",l:"Bandô Solution (Branco/Preto/Bronze)",unit:"ml-larg",cor:{W:194.02,C:213.43},maxLarg:99,note:"",
       compat:["CORTINA ROLÔ"]},
      {id:"r_bmaxi",l:"Bandô Maxi — Grandes Vãos",  unit:"ml-larg", cor:{W:152.05,C:167.26}, maxLarg:4.00,note:"Exclusivo Tubo 55mm R | Comando RPC Plus",
       compat:["CORTINA ROLÔ"]},
      {id:"r_bplus",l:"Bandô Box Plus — Grandes Vãos",unit:"ml-larg",cor:{W:422.68,C:null},maxLarg:4.00,note:"Exclusivo Grandes Vãos — apenas Branco",
       compat:["CORTINA ROLÔ"]},
      {id:"r_belg",l:"Bandô Elegance",              unit:"ml-larg", cor:{W:101.64,C:111.81},  maxLarg:3.00,note:"Confirmado na tabela Ago/2026 (16/09/2026)",
       compat:["CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_bpanel",l:"Bandô Plano em Alumínio (Painel)",unit:"ml-larg",cor:{W:51.99,C:null},maxLarg:99,note:"Apenas Branco | Base revestida: +R$15,00",
       compat:["CORTINA PAINEL"]}
    ]
  },
  {
    sec:"Barra Estabilizadora",
    items:[
      {id:"r_barest",l:"Barra Estabilizadora",unit:"ml-larg",cor:{W:42.88,C:47.17},maxLarg:99,note:"Branco ou Preto",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION","CORTINA NUETTE"]},
      {id:"r_barmov",l:"Perfil Barra de Movimento (Branco)",unit:"ml-larg",cor:{W:93.30,C:null},maxLarg:99,note:"Necessário acrescer Bandô na Rolô — apenas Branco",
       compat:["CORTINA ROLÔ"]}
    ]
  },
  {
    sec:"Guias Laterais",
    items:[
      {id:"r_gl6",l:"Guia Lateral 6cm (Par)",unit:"ml-alt",cor:{W:160.85,C:176.94},maxLarg:99,note:"por metro de ALTURA | Branco ou Colorido",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_gl8",l:"Guia Lateral 8cm (Par)",unit:"ml-alt",cor:{W:196.26,C:215.89},maxLarg:99,note:"por metro de ALTURA | Branco ou Colorido",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Guias Inferiores",
    items:[
      {id:"r_gi6",  l:"Guia Inferior 6cm",  unit:"ml-larg",cor:{W:80.13,C:88.15},  maxLarg:99,note:"por metro de LARGURA | Branco ou Colorido",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_gi8",  l:"Guia Inferior 8cm",  unit:"ml-larg",cor:{W:98.12,C:107.93}, maxLarg:99,note:"por metro de LARGURA | Branco ou Colorido",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_giL",  l:"Guia Inferior 'L'",  unit:"ml-larg",cor:{W:45.99,C:50.59},  maxLarg:99,note:"por metro de LARGURA | Branco ou Colorido",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Opcionais & Acabamentos",
    items:[
      {id:"r_junc",  l:"Kit Suporte Junção (diminui fresta entre 2 cortinas)",unit:"und",p:26.34, note:"",
       compat:["CORTINA ROLÔ"]},
      {id:"r_red",   l:"Comando RPC Redução (Tubo 55mm)",unit:"und",p:98.68,note:"Uso exclusivo Tubo 55mm",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_redplus",l:"Comando RPC Plus — Grandes Vãos",unit:"und",p:163.15,note:"Uso exclusivo Grandes Vãos",
       compat:["CORTINA ROLÔ"]},
      {id:"r_supduplo",l:"Suporte Duplo (2 peças no mesmo suporte)",unit:"und",p:141.63,note:"",
       compat:["CORTINA ROLÔ"]},
      {id:"r_romred",l:"Peça Romana Comando c/ Redução",unit:"und",p:54.70,note:"Confirmado na tabela Ago/2026 (16/09/2026)",
       compat:["CORTINA ROMANA"]},
      {id:"r_brvt_pvc",l:"Bandô Vertical em PVC",unit:"ml-larg",cor:{W:40.84,C:40.84},maxLarg:99,note:"",
       compat:["PERSIANA VERTICAL"]},
      {id:"r_trilho_prata",l:"Trilho Vertical Prata (completo)",unit:"ml-larg",cor:{W:73.13,C:73.13},maxLarg:99,note:"Padrão da tabela",
       compat:["PERSIANA VERTICAL"]},
      {id:"r_trilho_ouro",l:"Trilho Vertical Ouro/Branco (completo)",unit:"ml-larg",cor:{W:78.75,C:78.75},maxLarg:99,note:"Tabela: trilho branco = +R$6,00/ml sobre o prata",
       compat:["PERSIANA VERTICAL"]},
      {id:"r_ph50mono",l:"Monocontrole PH 50mm (c/ redução de peso)",unit:"und",p:140.40,note:"Obrigatório após limite de m²",
       compat:["PERSIANA HORIZONTAL"]},
      {id:"r_ph25mono",l:"Monocontrole PH 25mm",unit:"und",p:78.57,note:"Opcional",
       compat:["PERSIANA HORIZONTAL"]},
      {id:"r_ph25ev",l:"Mecanismo Entre-Vidros PH 25mm",unit:"und",p:106.13,note:"Opcional",
       compat:["PERSIANA HORIZONTAL"]},
      {id:"r_ph25cabo",l:"Cabo de Aço PH 25mm",unit:"und",p:38.72,note:"",
       compat:["PERSIANA HORIZONTAL"]}
    ]
  },
  {
    sec:"Motorização",
    items:[
      {id:"r_m6n",  l:"Motor Rolô RPC 6N",             unit:"und",p:609.78, note:"Tubo 41/55mm | Larg máx 3,00m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION","CORTINA NUETTE"]},
      {id:"r_mmaxi",l:"Motor Rolô RPC Maxi 10N",        unit:"und",p:787.35, note:"Grandes Vãos | Larg máx 5,00m",compat:["CORTINA ROLÔ"]},
      {id:"r_m4f",  l:"Motor Rolô RPC 4 Fios (Automação)",unit:"und",p:430.54,note:"Contato Seco",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_mwifi",l:"Motor Rolô RPC Connector 10N (Wi-Fi)",unit:"und",p:839.16,note:"",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_mbat", l:"Motor Rolô RPC Bateria",          unit:"und",p:1386.79,note:"Adicionar Fonte Bivolt R$189,39",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_fonte",l:"Fonte Bivolt RPC",                unit:"und",p:189.39, note:"Para motor bateria",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_rm6n", l:"Motor Romana RPC 6N",             unit:"und",p:845.08,note:"",compat:["CORTINA ROMANA"]},
      {id:"r_rm4f", l:"Motor Romana RPC 4 Fios",          unit:"und",p:706.99, note:"Automação",compat:["CORTINA ROMANA"]},
      {id:"r_rmwifi",l:"Motor Romana RPC Connector (Wi-Fi)",unit:"und",p:933.33,note:"",compat:["CORTINA ROMANA"]},
      {id:"r_rmbat",l:"Motor Romana RPC Bateria",         unit:"und",p:1566.26,note:"Adicionar Fonte Bivolt R$189,39",compat:["CORTINA ROMANA"]},
      {id:"r_ph50mot",l:"Motor PH 50mm RPC",             unit:"und",p:1001.10,note:"Exclusivo Cadarço",compat:["PERSIANA HORIZONTAL"]},
      {id:"r_ph50wf",l:"Motor PH 50mm RPC Wi-Fi",        unit:"und",p:1230.77,note:"Exclusivo Cadarço",compat:["PERSIANA HORIZONTAL"]}
    ]
  },
  {
    sec:"Controles Remotos",
    items:[
      {id:"r_rc1",   l:"Controle Remoto RPC 1 canal",    unit:"und",p:130.32,note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION","CORTINA CELULAR"]},
      {id:"r_rc15",  l:"Controle Remoto RPC 15 canais",  unit:"und",p:226.12,note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION","CORTINA CELULAR"]},
      {id:"r_rctimer",l:"Controle RPC c/ Timer 1 canal", unit:"und",p:200.54,note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"r_hub",   l:"HUB RPC Wi-Fi (RS485 integrado)", unit:"und",p:1314.28,note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  }
];

const ACC_DECORE = [
  {
    sec:"Bandô",
    items:[
      {id:"d_bstd",  l:"Bandô Rolo 8,15×8,65cm (máx 3,50m)", unit:"ml-larg",cor:{W:82.72,C:95.13},note:"Branco/Preto = preço base | Cinza/Bege: +15% | Larg máx 3,50m",maxLarg:3.50,
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_bb90",  l:"Bandô Box 90 9×9cm (máx 3,50m)",      unit:"ml-larg",cor:{W:194.10,C:223.22},note:"Branco/Preto = preço base | Cinza/Bege: +15% | Larg máx 3,50m",maxLarg:3.50,
       compat:["CORTINA ROLÔ"]},
      {id:"d_bb70",  l:"Bandô Box 70 7×7cm (máx 1,70m)",      unit:"ml-larg",cor:{W:146.66,C:null},  note:"Apenas Branco | Larg máx 1,70m | Incompatível c/ Redução",maxLarg:1.70,
       compat:["CORTINA ROLÔ"]},
      {id:"d_bdv",   l:"Bandô Double Vision 8×8cm",            unit:"ml-larg",cor:{W:89.43,C:102.84},  note:"Branco/Preto = preço base | Cinza/Bege: +15%",
       compat:["CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Barra Estabilizadora",
    items:[
      {id:"d_bcom",  l:"Barra Estabilizadora Comum",  unit:"ml-larg",cor:{W:39.36,C:45.26},note:"Branco/Preto = preço base | Cinza/Bege: +15%",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_bmov",  l:"Barra Estabilizadora Móvel",  unit:"ml-larg",cor:{W:43.10,C:null},note:"Não compatível com Trilho Móvel | Apenas Branco",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Guias Laterais",
    items:[
      {id:"d_gvao",  l:"Guia Lateral Vão 5,55cm",     unit:"ml-alt", cor:{W:131.73,C:151.49},note:"por metro de ALTURA | Branco/Preto base | Cinza/Bege: +15%",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_gpar6", l:"Guia Lateral Parede 6cm",      unit:"ml-alt", cor:{W:144.21,C:165.84},note:"por metro de ALTURA | Branco/Preto base | Cinza/Bege: +15%",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_gpar8", l:"Guia Lateral Parede 8cm",      unit:"ml-alt", cor:{W:177.98,C:null},note:"por metro de ALTURA — apenas Branco",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Guias Inferiores",
    items:[
      {id:"d_givao", l:"Guia Inferior Vão 5,55cm",    unit:"ml-larg",cor:{W:65.87,C:75.75},note:"por metro de LARGURA | Branco/Preto base | Cinza/Bege: +15%",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_gipar6",l:"Guia Inferior Parede 6cm",    unit:"ml-larg",cor:{W:72.11,C:82.93},note:"por metro de LARGURA | Branco/Preto base | Cinza/Bege: +15%",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_gipar8",l:"Guia Inferior Parede 8cm",    unit:"ml-larg",cor:{W:88.99,C:null},note:"por metro de LARGURA — apenas Branco",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]}
    ]
  },
  {
    sec:"Opcionais & Acabamentos",
    items:[
      {id:"d_junc",  l:"Junção (diminui espaço entre 2 cortinas)",unit:"und",p:20, note:"",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_red",   l:"Redução de Peso / Comando Redutor (sem desconto)",unit:"und",p:75,note:"Auto: larg ≥1,80m OU alt ≥2,00m",
       compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION","CORTINA NUETTE"]},
      {id:"d_ph50mono",l:"Monocomando 50mm (sem desconto)",unit:"und",p:120,note:"",
       compat:["PERSIANA HORIZONTAL"]},
      {id:"d_ph25mono",l:"Monocomando 25mm (sem desconto)",unit:"und",p:60,note:"",
       compat:["PERSIANA HORIZONTAL"]},
      {id:"d_ph25ev",l:"Comando Entre-Vidros (sem desconto)",unit:"und",p:80,note:"",
       compat:["PERSIANA HORIZONTAL"]}
    ]
  },
  {
    sec:"Motorização",
    items:[
      {id:"d_mmec",  l:"Motor Mecânico 4 Fios 220v",    unit:"und",p:310.10,note:"Larg máx 3,50m | Alt máx 6,00m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mrf",   l:"Motor Mecânico RF 220v",         unit:"und",p:422.55,note:"",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mele",  l:"Motor Eletrônico RF 220v",       unit:"und",p:550.79,note:"",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mt38",  l:"Motor T38 Eletrônico Bivolt",        unit:"und",p:395.58,note:"Larg máx 1,80m | Alt máx 2,70m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mt38wf",l:"Motor T38 Eletrônico Bivolt Wi-Fi",  unit:"und",p:438.97,note:"Larg máx 1,80m | Alt máx 2,70m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mwmec", l:"Motor Mecânico Wi-Fi 220v",          unit:"und",p:491.61,note:"Larg máx 3,50m | Alt máx 6,00m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_mwele", l:"Motor Eletrônico Wi-Fi Bivolt",      unit:"und",p:629.71,note:"Larg máx 4,50m | Alt máx 7,50m",compat:["CORTINA ROLÔ","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_rmmot", l:"Motor Romana Mecânico 220v",              unit:"und",p:591.21,note:"Larg máx 2,80m | Alt máx 3,50m",compat:["CORTINA ROMANA"]},
      {id:"d_rmmotwf",l:"Motor Romana Mecânico Wi-Fi 220v",       unit:"und",p:660.26,note:"Larg máx 2,80m | Alt máx 3,50m",compat:["CORTINA ROMANA"]},
      {id:"d_ph50mot",l:"Motor PH 50mm 220v (só cadarço)",  unit:"und",p:505.43,note:"Larg máx 2,40m | Alt máx 3,50m",compat:["PERSIANA HORIZONTAL"]},
      {id:"d_ph50motwf",l:"Motor PH 50mm 220v Wi-Fi (só cadarço)",unit:"und",p:574.49,note:"Larg máx 2,40m | Alt máx 3,50m | App Smart Life",compat:["PERSIANA HORIZONTAL"]}
    ]
  },
  {
    sec:"Controles Remotos",
    items:[
      {id:"d_dc1",   l:"Controle 1 canal (T38/Mec/Elet/Wi-Fi)",       unit:"und",p:93.41, note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_dc16",  l:"Controle 16 canais (T38/Mec/Elet/Wi-Fi)",      unit:"und",p:173.71,note:"",compat:["CORTINA ROLÔ","CORTINA ROMANA","CORTINA ELEGANCE / DOUBLE VISION"]},
      {id:"d_bpi1",  l:"Controle 1 canal (PH 50mm)",    unit:"und",p:93.41,note:"",compat:["PERSIANA HORIZONTAL"]},
      {id:"d_bpi15", l:"Controle 16 canais (PH 50mm)",  unit:"und",p:173.71,note:"",compat:["PERSIANA HORIZONTAL"]},
      {id:"d_jmt",   l:"Junção c/ Tração (2 Rolos / 1 Motor)",unit:"und",p:47,note:"",compat:["CORTINA ROLÔ"]}
    ]
  }
];


// CORTINA TRADICIONAL — PRODUÇÃO PRÓPRIA CDP (tecido por metro linear de largura)
// Preços vindos da planilha 'PLANILHA PRODUTOS E CÁLCULOS - CDP.xlsx' (aba PREÇOS CORTINA TRADICIONAL) — a confirmar com a Bru
const CDP_TRAD = {
  voil:[
    {
      nome:"Calêdula",
      preco:290
    },
    {
      nome:"Canela",
      preco:290
    },
    {
      nome:"Carvalho",
      preco:330
    },
    {
      nome:"Cristal",
      preco:240
    },
    {
      nome:"Cross",
      preco:260
    },
    {
      nome:"Damasco",
      preco:400
    },
    {
      nome:"Deluxe",
      preco:480
    },
    {
      nome:"Dolly",
      preco:230
    },
    {
      nome:"Dália",
      preco:320
    },
    {
      nome:"Flor De Maio",
      preco:350
    },
    {
      nome:"Gaze De Linho",
      preco:300
    },
    {
      nome:"Girassol",
      preco:330
    },
    {
      nome:"Hibisco",
      preco:290
    },
    {
      nome:"Ipê",
      preco:290
    },
    {
      nome:"Jacarandá",
      preco:290
    },
    {
      nome:"Leda",
      preco:305
    },
    {
      nome:"Leda Rústico",
      preco:350
    },
    {
      nome:"Libia",
      preco:400
    },
    {
      nome:"Linho Egito",
      preco:470
    },
    {
      nome:"Linho Nature",
      preco:null
    },
    {
      nome:"Linhão",
      preco:700
    },
    {
      nome:"Liso",
      preco:200
    },
    {
      nome:"Luxor",
      preco:570
    },
    {
      nome:"Macadâmia",
      preco:270
    },
    {
      nome:"Madras",
      preco:null
    },
    {
      nome:"Moréia",
      preco:270
    },
    {
      nome:"Mônaco",
      preco:null
    },
    {
      nome:"Nilo",
      preco:null
    },
    {
      nome:"Persa",
      preco:330
    },
    {
      nome:"Pinus",
      preco:350
    },
    {
      nome:"Primavera",
      preco:null
    },
    {
      nome:"Prime",
      preco:620
    },
    {
      nome:"Shantung Linen",
      preco:430
    },
    {
      nome:"Suíço",
      preco:260
    },
    {
      nome:"Tafeta",
      preco:350
    },
    {
      nome:"Tulipa",
      preco:null
    },
    {
      nome:"Veneza Gorgurão",
      preco:350
    }
  ],
  forro:[
    {
      nome:"Microfibra",
      preco:180
    }
  ],
  blackoutUnica:[
    {
      nome:"Cairo 70%",
      preco:930
    },
    {
      nome:"Linho 70%",
      preco:690
    },
    {
      nome:"Liso 70%",
      preco:380
    },
    {
      nome:"Rústico 70%",
      preco:550
    },
    {
      nome:"Super Afrodite 100%",
      preco:900
    },
    {
      nome:"Super Black 100%",
      preco:480
    },
    {
      nome:"Super Zeus 100%",
      preco:1100
    }
  ],
  blackoutSimples:[
    {
      nome:"Liso 70%",
      preco:280
    },
    {
      nome:"Super Black 100%",
      preco:300
    }
  ]
};
