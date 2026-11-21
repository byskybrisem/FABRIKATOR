import React, { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { act, cost, materials, openWorkshop, readGame, recipe, revenue, stage, type Game } from './src/workshop';
import { Factory } from './src/Factory';

const money=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2,minimumFractionDigits:0}).format(n/100);
const steps = {
  buy:['Malzeme al','Bir parti için 20 tahta ve 10 bağlantı seti satın al.', 'Malzemeleri al'],
  start:['Üretim emri','Malzemeleri ve işçilik bedelini kullanarak 10 sandalye üret.', 'Üretimi başlat'],
  collect:['Montaj hattı','Üretim süresi dolunca 10 sandalyeyi mamul deposuna al.', 'Depoya al'],
  sell:['Parti satışı','10 sandalyeyi tanesi '+money(recipe.unitSale)+' karşılığında birlikte sat.', '10 sandalyeyi sat']
} as const;

function Workshop() {
  const [db,setDb]=useState<SQLiteDatabase|null>(null);
  const [game,setGame]=useState<Game|null>(null);
  const [now,setNow]=useState(Date.now);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let handle:SQLiteDatabase|undefined;
    try { handle=openDatabaseSync('fabrikator.db'); setGame(openWorkshop(handle)); setDb(handle); setError(''); }
    catch { setError('Atölye kaydı açılamadı. Tekrar deneyin.'); }
    return ()=>handle?.closeSync();
  },[attempt]);
  useEffect(()=>{
    if(game?.ready_at==null) return;
    const tick=()=>setNow(Date.now());
    tick();
    const timer=setInterval(tick,500);
    const sub=AppState.addEventListener('change',s=>{if(s==='active')tick()});
    return ()=>{clearInterval(timer);sub.remove()};
  },[game?.ready_at]);
  if(!game || !db) return <SafeAreaView style={s.page}><Text style={s.heading}>{error || 'Atölye açılıyor…'}</Text>
    {!!error && <Pressable accessibilityRole="button" onPress={()=>setAttempt(x=>x+1)}><Text style={s.desc}>Tekrar dene</Text></Pressable>}</SafeAreaView>;
  const phase=stage(game);
  const remaining=Math.max(0,Math.ceil(((game.ready_at??now)-now)/1000));
  const waiting=phase==='collect' && remaining>0;
  const duration=recipe.durationMs/1000;
  const title=steps[phase];
  const perform=()=>{try { setGame(act(db,phase,game.revision));setNow(Date.now());setError(''); }
    catch(e){setError(e instanceof Error?e.message:'İşlem kaydedilemedi.');setGame(readGame(db));}};
  return <SafeAreaView style={s.page}>
    <StatusBar barStyle="dark-content"/>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.row}><Text style={s.brand}>FABRİKATÖR</Text><Text style={s.meta}>MOBİLYA ATÖLYESİ</Text></View>
      <View style={s.hero}><View style={s.row}><Text style={s.meta}>ÜRETİM SAHASI</Text><Text style={s.code}>A–01</Text></View>
        <Text accessibilityRole="header" style={s.heading}>Sandalye hattı</Text><Factory stage={phase}/>
        <View style={s.row}><Text style={s.small}>Ahşap işleme</Text><Text style={s.small}>10 adet / parti</Text></View></View>
      <View style={s.row}><View style={s.wallet}><Text style={s.meta}>KASA</Text><Text style={s.number}>{money(game.cash)}</Text></View>
        <View style={s.wallet}><Text style={s.meta}>SATIŞ KÂRI</Text><Text style={s.number}>{money(game.profit)}</Text></View></View>
      <Text accessibilityRole="header" style={s.subtitle}>Depo</Text>
      <View style={s.stock}>{[['Tahta',game.boards],['Bağlantı seti',game.kits],['Sandalye',game.chairs]].map(([k,v])=><View key={k} style={s.cell}><Text style={s.number}>{v}</Text><Text style={s.small}>{k}</Text></View>)}</View>
      <Text accessibilityRole="header" style={s.subtitle}>Parti hesabı</Text>
      {([['Ham madde',money(materials)],['İşçilik',money(recipe.labor)],['Birim maliyet',money(cost/recipe.chairs)],['Satış geliri',money(revenue)],['Toplam satılan',game.sold+' sandalye']]).map(([k,v])=><View key={k} style={s.line}><Text style={s.desc}>{k}</Text><Text style={s.value}>{v}</Text></View>)}
    </ScrollView>
    <View style={s.dock}><Text accessibilityRole="header" style={s.subtitle}>{title[0]}</Text><Text style={s.desc}>{title[1]}</Text>
      {phase==='collect' && <View style={s.track}><View style={[s.fill,{width:`${Math.max(0,1-remaining/duration)*100}%`}]}/></View>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{disabled:waiting}} disabled={waiting} onPress={perform}
        style={({pressed})=>[s.button,waiting&&s.disabled,pressed&&{opacity:0.8}]}>
        <Text style={s.buttonText}>{waiting?`Üretiliyor · ${remaining} sn`:title[2]+(phase==='buy'?' · '+money(materials):phase==='start'?' · '+duration+' sn':'')}</Text></Pressable></View>
  </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><Workshop/></SafeAreaProvider>;}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#faf9f5'},content:{padding:20,gap:13},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},
 brand:{fontSize:20,fontWeight:'900',letterSpacing:1.4,color:'#183c35'},meta:{fontSize:11,fontWeight:'700',letterSpacing:1,color:'#49675c'},hero:{backgroundColor:'#e9eee5',borderRadius:18,padding:16},heading:{fontSize:32,fontWeight:'800',letterSpacing:-1,color:'#193b30'},code:{fontSize:12,color:'#5e7366'},small:{fontSize:13,color:'#42584c'},
 wallet:{flex:1,padding:13,borderWidth:1,borderColor:'#d5ddd2',borderRadius:12,gap:5},number:{fontSize:22,color:'#213d34',fontWeight:'700',fontVariant:['tabular-nums']},subtitle:{fontSize:19,fontWeight:'700',color:'#243f35'},stock:{flexDirection:'row',backgroundColor:'#edf0e9',borderRadius:12,paddingVertical:12},cell:{flex:1,alignItems:'center',gap:3},
 line:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#d6dbd2',paddingBottom:6},desc:{color:'#4c5d51',fontSize:14},value:{color:'#263f34',fontWeight:'600'},
 dock:{backgroundColor:'#fffefa',borderTopWidth:1,borderColor:'#d7ded3',paddingHorizontal:20,paddingVertical:12,gap:6},button:{backgroundColor:'#215946',padding:14,borderRadius:12,alignItems:'center',marginTop:4},disabled:{backgroundColor:'#496459'},buttonText:{color:'white',fontWeight:'700',fontSize:16},track:{height:4,backgroundColor:'#d5ded2',borderRadius:3},fill:{height:4,backgroundColor:'#428266'},error:{color:'#a03b31'}
});
