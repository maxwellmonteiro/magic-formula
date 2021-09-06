const express = require('express')
const app = express()

const fetch = require('node-fetch');
const jsdom = require('jsdom');

const RESULTADOS_URL = 'https://fundamentus.com.br/resultado.php';
const DETALHES_URL = 'https://fundamentus.com.br/detalhes.php?papel=';

async function calcMagicFormula(doc) {
   
    /*
      PARA A FORMULA ORIGINAL USE OS PARAMETROS ABAIXO, IGNORANDO O DIVY:
         FATOR_PRECO   = 1;
         FATOR_LUCRO   = 1;
         FATOR_DIVY    = 0;
     */
    /*let FATOR_PRECO   = 1.1;
    let FATOR_LUCRO   = 1;
    let FATOR_DIVY    = 0.5;*/
    const FATOR_PRECO   = 1;
    const FATOR_LUCRO   = 1;
    const FATOR_DIVY    = 0;   
    
    let papeis     = [];
    let empresas   = {};
    
    const resultados = doc.querySelectorAll('#resultado tr');
    for (tr of resultados) {
      let ticker   = tr.querySelector('td:nth-child(1) > span > a')     
      let ev_ebit  = tr.querySelector('td:nth-child(11)')
      let roic     = tr.querySelector('td:nth-child(16)') 
      let liq      = tr.querySelector('td:nth-child(18)')
      let pl       = tr.querySelector('td:nth-child(3)')
      let div      = tr.querySelector('td:nth-child(20)')
      let dy       = tr.querySelector('td:nth-child(6)')
      let valorPatrimonial;
      
      if(!ticker || !ev_ebit || !roic || !liq || !pl || !div || !dy){ continue }  
            
      ticker    = ticker.text;
      
      // ignora UNITS?
      if(ticker.endsWith('11')) { continue }
      
      ev_ebit   = Number.parseFloat(ev_ebit.textContent.replace('.','').replace(',','.'))
      roic      = Number.parseFloat(roic.textContent.replace('.','').replace(',','.'))
      liq       = Number.parseFloat(liq.textContent.replace('.','').replace(',','.'))
      pl        = Number.parseFloat(pl.textContent.replace('.','').replace(',','.'))
      div       = Number.parseFloat(div.textContent.replace('.','').replace(',','.'))
      dy        = Number.parseFloat(dy.textContent.replace('.','').replace(',','.'))

      docDetalhes = await obterDetalhes(`${DETALHES_URL}${ticker}`);
      valorPatrimonial = getValorPatrimonial(docDetalhes);
      
      // ignora ebit e roic negativo
      if(ev_ebit < 0 || roic < 0 ) { continue }
      
      // ignora empresas que não possuem lucro, P/L deve ser positivo
      //if(pl <= 0) { return }
      
      // ignorar se o valor de mercado inferior a US$ 40.000 conforme formula
      if(valorPatrimonial < 200.000) { continue }
      
      // só permite empresas com dívidas equilibradas (Dívida Bruta/Patrimonio >  3)
      //if(div > 3) { return }
      
      let papel = {ticker, ev_ebit, roic, dy}
      
      // agrupa por empresa para pegar o papel com maior liquidez apenas
      let empresa = ticker.replace(/\d+$/,'')
      if(!empresas[empresa]){
         empresas[empresa] = []
      }
      empresas[empresa].push(papel)
      papeis.push(papel)
    }
    
    let rank = 0;
    
    // ordenar ev_ebit do menor para maior e aplicar rank (mais baratos no início)
    papeis.sort((a, b)=>{ return a.ev_ebit - b.ev_ebit })
    papeis.forEach((a)=>{
       rank++    
       a.rank1 = rank*(1/FATOR_PRECO)
    })
    
    rank = 0;
 
    // ordenar roic do maior para menor e aplicar rank (maior lucro no inicio)   
    papeis.sort((a, b)=>{ return b.roic - a.roic })   
    papeis.forEach((a)=>{      
       rank++
       a.rank = a.rank1 + rank*FATOR_LUCRO
    })  
    
    // Obtém os papeis mais bem colocados por empresa (Ordinárias vs Preferenciais)
    papeis = Object.keys(empresas)
       .map((empresa)=>{
          empresas[empresa].sort((a, b)=>{ return a.rank - b.rank })
          return empresas[empresa][0]
       })
    
    // Finalmente gera a ordenação final
    papeis.sort((a, b)=>{ return a.rank - b.rank })
       
    console.log(`pos\tticker\tev_ebit\troic\trank`);
    let saida = papeis
       //.slice(0, 50)
       .map((a, i)=>{
          return `${(i + 1)}\t${a.ticker}\t${a.ev_ebit}\t${a.roic}\t${a.rank}`;
       })
       .join('\n')
       
    console.log(saida)
}

async function obterDetalhes(url) {
    htmlDetalhes = await fetch(url).then(resp => resp.text());
    return new jsdom.JSDOM(htmlDetalhes).window.document;
}

function getValorPatrimonial(doc) {
    const conteudo = doc.querySelector('.conteudo.clearfix');
    const tabela = conteudo.querySelector('table:nth-child(3)');
    const linha = tabela.querySelectorAll('tr')[1];
    const numAcoes = linha.querySelector('td:nth-child(4)');
    const cotacao = doc.querySelector('.data.destaque.w3');

    const fNumAcoes = Number.parseFloat(numAcoes.textContent.replace('.', '').replace(',', '.'));
    const fCotacao = Number.parseFloat(cotacao.textContent.replace('.', '').replace(',', '.'));

    return fNumAcoes * fCotacao;
}

async function run() {
    const htmlResultados = await fetch(RESULTADOS_URL).then(resp => resp.text());
    
    const domResultados = new jsdom.JSDOM(htmlResultados);    

    calcMagicFormula(domResultados.window.document);    
}


app.get('/', (req,res) => {
    run();
})

const port = 3000;

app.listen(port, () => {
  console.log(`htttp://localhost:${port}`);
})