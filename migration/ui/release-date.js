// Calendar dates use their written date, without timezone shifts or invented days.
function normalize(value){
 const text=String(value??'').trim();
 if(!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text))return '';
 const date=text.slice(0,10),[year,month,day]=date.split('-').map(Number);
 if(year<1800||year>3000||month<1||month>12)return '';
 return day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate()?date:'';
}
function legacyYear(value){const text=String(value??'');return /^\d{4}$/.test(text)&&Number(text)>=1800&&Number(text)<=3000?text:'';}
function value(album={}){return normalize(album.releaseDate)||legacyYear(album.year)||legacyYear(album.releaseYear);}
function valid(value){return !String(value??'').trim()||!!normalize(value)||!!legacyYear(value);}
function fields(value){const date=normalize(value),year=legacyYear(value);return {releaseDate:date||null,year:date?Number(date.slice(0,4)):year?Number(year):null};}
module.exports={normalize,legacyYear,value,valid,fields};
