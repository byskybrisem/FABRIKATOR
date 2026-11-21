import React from 'react';
import Svg, { G, Path, Ellipse, Circle } from 'react-native-svg';
import type { Command } from './workshop';

function Block({x,y,w,d,h,colors}: {x:number;y:number;w:number;d:number;h:number;colors:string[]}) {
  return <G transform={`translate(${x} ${y})`}>
    <Path d={`M0 0 l${w} ${w/2} 0 ${h} -${w} -${w/2}Z`} fill={colors[1]}/>
    <Path d={`M${w} ${w/2} l${d} -${d/2} 0 ${h} -${d} ${d/2}Z`} fill={colors[2]}/>
    <Path d={`M0 0 l${d} -${d/2} ${w} ${w/2} -${d} ${d/2}Z`} fill={colors[0]}/>
  </G>;
}
const wood=['#e8b880','#c98851','#a9693c'];
const steel=['#9faeb2','#71848a','#465e65'];
function Chair({x,y}:{x:number;y:number}) {
  return <G transform={`translate(${x} ${y})`}>
    {[0,12].map(i=><G key={i}><Path d={`M${i} ${i/2}v11 m10 -16v10`} stroke="#97603c" strokeWidth={2.4}/></G>)}
    <Block x={-1} y={0} w={14} d={12} h={2.5} colors={wood}/>
    <Path d="M11 -5v-11l14 7v11Z" fill="#d89d60"/>
  </G>;
}
export function Factory({stage}:{stage:Command}) {
  return <Svg width="100%" height={160} viewBox="0 0 320 150" accessible={false}>
    <Ellipse cx={159} cy={108} rx={126} ry={23} fill="#d6ddd4"/>
    <Block x={38} y={70} w={133} d={111} h={6} colors={['#e7e3d0','#b8b4a1','#c9c4af']}/>
    <Block x={49} y={36} w={68} d={57} h={45} colors={['#e6ded0','#e6ccab','#bba588']}/>
    {[0,1,2].map(i=><G key={i} transform={`translate(${i*22} ${i*11})`}>
      <Path d="M46 36l59 -29 23 7 -59 30Z" fill={i===1?'#537e75':'#709389'}/>
      <Path d="M46 36l23 8v5Z" fill="#395850"/>
      <Path d="M55 51l13 6v14l-13 -6Z" fill="#557572"/>
      <Path d="M61.5 54v14" stroke="#ddd1b8" strokeWidth={1.6}/>
    </G>)}
    <Path d="M126 81V66l26 -13v28l-26 13Z" fill="#475952"/>
    <Block x={174} y={78} w={34} d={16} h={11} colors={steel}/>
    <Block x={175} y={72} w={32} d={14} h={4} colors={wood}/>
    <Circle cx={200} cy={76} r={4} fill={stage==='collect'?'#ffba63':'#c0cbc8'}/>
    {stage==='start' && [0,1,2].map(i=><Block key={i} x={156} y={105-i*3} w={24} d={10} h={2} colors={wood}/>)}
    {stage==='sell' && <><Chair x={158} y={101}/><Chair x={183} y={112}/><Chair x={206} y={101}/></>}
    <Block x={239} y={69} w={13} d={12} h={11} colors={wood}/>
  </Svg>;
}
