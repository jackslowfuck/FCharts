;$(function(){
	/**
	 * 	@全局变量统一大写，多个单词的首字母大写的驼峰式写法，便于理解
	 * 	@未压缩版的svg元素加了class便于DOM结构的观察，压缩版将去掉一些仅用于观察的无效class，以减小文件大小
	 */
	var $ = jQuery,
		UNDEFINED = undefined,
		WIN = window,
		DOC = document,
		$WIN = $(WIN),
		$DOC = $(DOC),
		$BODY = $('body'),
		
		MATH = Math,
		MathRandom = MATH.random,
		MathRound = MATH.round,
		MathFloor = MATH.floor,
		MathCeil = MATH.ceil,
		MathMax = MATH.max,
		MathMin = MATH.min,
		MathAbs = MATH.abs,
		MathSqrt = MATH.sqrt,
		
		
		SVG={	//SVG命名空间
			ns: 'http://www.w3.org/2000/svg',
			xlink: 'http://www.w3.org/1999/xlink'
		},
		
		Browser=function(){	//判断浏览器
			var userAgent=navigator.userAgent.toLowerCase();
			return {
				ff: -1 != userAgent.indexOf('firefox') ? 1 : 0,	//火狐
				ie: -1 != userAgent.indexOf('trident') ? 1 : 0	//ie
			}
		}(),

		/**
		 *	存储全局变量、索引、图表对象等
		 * 
		 */
		global_loadingImg='<img src="'+siteUrl+'templates/default/assets/image/charts/loading.gif" alt="">',
		GLOBAL={
			color:{
				gray: '#f0f0f0',
				black: '#000'
			},
			zIndex: 9,
			loadingHtml:'<div class="capi-loading">'+global_loadingImg+'</div>',
			loadingSVG: '<div class="capi-loading-svg">'+global_loadingImg+'<i></i></div>'
		};
		
	WIN.chartsUpdate=function(msg){	//图表动态更新，对html页面的js或其他外部的js提供接口以接受数据
		var time=msg.time,
			syncChartsData=WIN.syncChartsData;
			
		if( time==syncChartsData.lastTime ){	//保证一分钟才更新一次
			return
		}else{
			syncChartsData.lastTime=time	//设置更新时间
		}
		if( time>='15:00' ){	//到15:00就没有更新了，删除动态更新的动画，设置重绘动画闪动参数
			$('svg circle.capi-dynamic').remove();			//分时删除更新
			$('svg .capi-dynamic').removeAttr('class');		//K线删除更新
			syncChartsData.time.flash=syncChartsData.k.flash=0;
		}
		
		GLOBAL.Kchart.update(msg);
		GLOBAL.Timechart.update(msg);
	};
	WIN.changeKChartBottom=function(index){	//k线图底部切换
		GLOBAL.Kchart.changeBottom(index)
	};
	
	function throttle(fn,delay,must){	//函数节流( 执行函数[，延迟时间 [，必须时间]] )
		var startTime=new Date(),
			must=must || 12,
			timer;
		
		return function(){
			var context=this,
				arg=arguments;
				
			clearTimeout(timer);
			
			if(!delay && new Date()-startTime>must){
				startTime=new Date();
				fn.call(context,arg)
				
			}else if(delay){
				timer=setTimeout(function(){
					startTime=new Date();
					fn.call(context,arg)
				},delay)
			}
		}
	}
	
	/**
	 *	数组方法：
	 *		toSingle( 数组 )			->	将多维数组转换成一维数组
	 * 		sum( 数组[,运算符] )		->  数组求和
	 * 		maximin( 数组 )			->	计算多维数组的最大最小值
	 * 		max( 数组 )				->	计算多维数组的最大值
	 * 		min( 数组 )				->	计算多维数组的最小值
	 */
	function arrToSingle(aData){
		for(var i=0, len=aData.length, arr=[]; i<len; i++){
			arr=arr.concat( Array.isArray(aData[i]) ? arguments.callee(aData[i]) : aData[i] )
		}
		return arr
	}
	
	function arrSum(aData, sign){
		return eval( arrToSingle(aData).join( sign || '+' ) )
	}
	
	function arrMaximin(aData){
		var arr=arrToSingle(aData);
		return {
			max: MathMax.apply(null,arr),
			min: MathMin.apply(null,arr)
		}
	}
	
	function arrMax(aData){
		return MathMax.apply(null, arrToSingle(aData))
	}
	
	function arrMin(aData){
		return MathMin.apply(null, arrToSingle(aData))
	}
	/************************ END Array ***********************/
	
	function pInt(str, radix){	//简化parseInt操作
		return parseInt(str, radix || 10)
	}
	
	function formatVol(str){	//把传进来的字符串成交量（'545237300.00'）格式化以万为单位的数值（5452.37万）
		return (str/10000).toFixed(2)+'万'
	}
	
	function randomColor(opacity){	//随机色 [透明度]
		return 'rgba('+	MathRound( MathRandom()*255 ) +','+
						MathRound( MathRandom()*255 ) +','+
						MathRound( MathRandom()*255 ) +','+
						(opacity || 1) +')'
	}
	
	//--------------------- 图表类函数集 --------------------------
	function yAxis( maxMin, yHeight ){
		var max = MathCeil( maxMin.max ),
			min = maxMin.min,
			yOneSize = 50,	//y轴度的间距
			yNum = MathAbs( MathFloor( yHeight/yOneSize ) ),		//y轴刻度个数
			//数据平均值= 数值间距（差值） / y轴刻度个数
			mean = MathCeil( (max - min) / yNum ),
			DValue = mean * yNum;
		
		//console.log( maxMin.max - DValue )
		return {
			max: max,
			min: max - DValue,
			oneMean: mean,
			yNum: yNum,
			yOneSize: yHeight / yNum,
			DValue: DValue
		}
	}
	
	//---------------------------- 元素类函数集开始 -------------------
	function createSE(sElem){	//创建SVG类元素 [元素名称]，并返回jQuery对象
		return $( DOC.createElementNS(SVG.ns, sElem.trim()) )
	}
	
	/**
	 *	为所有的图表创建通用标题:
	 * 		createTitle(文字大小，标题父级（jQuery对象），数组↓)
	 * 
	 * 		line -> ['指数','2012-02-24','PPI：13.9 CGPI的前身是国内批发物价指数-2626']
	 * 		K    -> ['K线图(日)','2015-05-05','开：','17.73','高：','17.75','低：','16.85','收：','17.08','量：','37538.64万','幅：','-4.10%']
	 * 		time -> ['分时图','2015-05-05 09:36','价：','17.73','量：','84.37万','幅：','-0.45%']
	 */
	function createTitle(fontSize,elem,arr){
		var oText=elem.appendSE('text',{
				y: 13+fontSize*.5		//(30-fontSize)/2+fontSize-2
			}),
			len=arr.length,
			i=0,
			oTspan;
		
		for(; i<len; i++){
			oTspan=createSE('tspan').text(arr[i]);
			i==0 && oTspan.attr('font-weight','bold');
			(i==1 || i%2==0) && oTspan.attr('dx',10);
			oText.append(oTspan)
		}
		return oText
	}
	
	/**
	 *	yTextCalc： 给y轴文本g添加文本
	 * 	yText：图表初始化时的y轴文本创建
	 * 	drawYText：重绘时y轴文本的创建，先清空，再创建相应个数的text
	 * 		当前是直接清空，做法可以优化，按需清空或替换
	 */
	function formatLargeAmo( num ){
		if( num > 100000000 ){
			return ( num / 100000000 ).toFixed(1) + '亿'
		}else if( num > 100000 ){
			return ( num / 10000 ).toFixed(1) + '万'
		}else{
			return num
		}
	}
	
	function yTextCalc(yG, fontSize, yNum, yOneSize, max, oneMean, hotEvent, options ){
		var g=yG.appendSE('g');		//用于兼容ie，innerHTLM=''，ie无效，所以新增g，用于重绘y轴时删除、添加
		
		fontSize=fontSize/2;
		
		for( var i = 0; i <= yNum; i++ ){
			g.appendSE('text',{
				y: MathFloor( i*yOneSize ) + 29.5 + fontSize
				
			}).text( formatLargeAmo( max - oneMean * i ) + ( hotEvent ? '%' : '' ) )
		}

		if( hotEvent ){
			var zeroY = MathFloor( max/(max-options.min) * options.yHeight ) + 29.5;

			g.appendSE( 'text', {

				y: zeroY + fontSize,
				fill: 'red'

			}).text( '0%' );

			options.bgline.find( '.capi-zero-line' ).remove();
			options.bgline.find( 'g' ).appendSE('path',{
				class: 'capi-zero-line',
				d: 'M1 '+ zeroY +'L'+ options.mainWidth +' '+ zeroY,
				'stroke-dasharray': '6',
				stroke: 'red'
			});

		}
		
		return yG	//返回yg供initYText做返回值
	}
	
	function initYText(main, yNum, yOneSize, max, oneMean, fontSize, hotEvent, options){	//绘制y轴文本
		var yText=createSE('g').attr({
				class: 'capi-yaxis',
				transform: 'translate(-8,0)',
				'text-anchor': 'end'
			});
		
		return yTextCalc(yText, fontSize, yNum, yOneSize, max, oneMean, hotEvent, options ).appendTo( main )
	}
	
	function drawYText(yAxisG, maxMin, yHeight, fontSize, hotEvent, options){
		var o=yAxis(maxMin, yHeight),
			yNum=o.yNum;
		
		$('g', yAxisG).remove();
		yTextCalc(yAxisG, fontSize/2, yNum, o.yOneSize, o.max, o.oneMean, hotEvent,{
			min: o.min,
			yHeight: options.yHeight,
			bgline: options.bgline,
			mainWidth: options.mainWidth
		});
		
		return {
			yNum: yNum,
			max: o.max,
			DValue: o.DValue,
			yOneSize: o.yOneSize
		};	//bgline重绘时，如果yNum一样，说明不需要重绘，性能优化
	}
	
	function createBgLine( bgline, yNum, yOneSize, mainWidth ){
		var bglineG=bgline.appendSE('g'),
			i=0,
			y;
			
		for(; i<yNum; i++){
			y=MathFloor( i*yOneSize )+29.5;
			
			bglineG.appendSE('path',{		//灰色刻度
				d: 'M1 '+y+'L'+mainWidth+' '+y,
				stroke: GLOBAL.color.gray
			});
			
			bglineG.appendSE('path',{	//黑色刻度
				d: 'M0 '+y+'L-4 '+y,
				stroke: GLOBAL.color.black
			});
		}

	}
	/******************************** Linechart start **********************************/
	function Linechart(box,Options){
		this.init(box,Options)
	}
	
	Linechart.prototype={
		init:function(box,Options){
			var settings=$.extend(true,{
					style: {
						font: '12px "\\5FAE\\8F6F\\96C5\\9ED1"',
						overflow: 'hidden',
						'box-sizing': 'border-box',
						padding: '10px'
					},
					dataType: 'common',
					title:'指数',
					xAxis: [],
					series: []
				},Options),
			
			svg=box.appendSE('svg',{
				width:'100%',
				height:'100%',
				xmlns:SVG.ns
				
			}).css(settings.style),
			
			svgWidth=svg.width(),
			svgHeight=svg.height(),
			fontSize=pInt( svg.css('font-size') ),
			
			serIndex=[],
			xLength,
			main,
			title;
			
			if( Browser.ff ){	//火狐计算带padding的svg宽高时，会加上padding
				svgWidth = svgWidth - pInt( svg.css('paddingLeft') ) - pInt( svg.css('paddingRight') );
				svgHeight = svgHeight - pInt( svg.css('paddingTop') ) - pInt( svg.css('paddingBottom') )
			}
			if( svgWidth<10 || svgHeight<80 ) return svg.remove(), box.text('屏幕太小无法显示');	//当盒子宽高不够以无法显示图形时，不绘图
			/******************* 以上基本参数配置 *****************************/
			
			settings.series.forEach(function(v,i){
				serIndex.push(i)
			});
			
			main=createSE('g').attr( 'class','capi-main' );	//创建整体
			
			xLength=settings.xAxis.length;	//x轴数据长度
			
			title=createTitle(
				fontSize,
				main,
				[
					settings.title,
					settings.xAxis[xLength-1],
					settings.series[0].title && settings.series[0].title[xLength-1] || ''
				]
			);
			
			var _this=this;
			_this.global={
				box: box,
				svg: svg,
				settings: settings,
				svgWidth: svgWidth,
				svgHeight: svgHeight,
				fontSize: fontSize,
				serIndex: serIndex,	//series编号，对后面点击flag，改变对应线段及个数，hover提供接口；[0,1,2,3...]
				xLength: xLength,
				main: main,
				title: title,
				add:function(o){
					return $.extend(this,o), _this;
				}
			};
			
			_this.grid().line().xAxis().flag().hover();		//链式操作
			
			svg.append( main );	//所有执行完毕，将整体添加到svg中
		},
		grid:function(){
			var _this=this,
				thisGlobal=_this.global,
				main=thisGlobal.main,
				svgWidth=thisGlobal.svgWidth,
				fontSize=thisGlobal.fontSize*.5,
				settings=thisGlobal.settings,
				series=settings.series,
				mainHeight=thisGlobal.svgHeight-50,		//50 = 20(xAxis) + 30(flag)
				yHeight=mainHeight-30,	//30(title)
				color={
					gray: '#f0f0f0',	//浅灰色，用于背景线条
					black: '#000'
				},
				
				yTextlength,
				yTextWidth,
				xTextHalfWidth,
				mainWidth,
				translateX,
				i=4,
				d,
				bgline,
				yAxisG,
				
				arr=[];
			
			series.forEach(function(v){
				arr.push( v.data )
			});
			
			var o=yAxis( arrMaximin( arr ), yHeight),
				max=o.max,
				min=o.min,
				oneMean=o.oneMean,
				yNum=o.yNum,
				yOneSize=o.yOneSize,
				DValue=o.DValue;

			yTextlength=arrMax( [max.toFixed(2).length, min.toFixed(2).length] );
			yTextWidth=yTextlength*fontSize+8;	//-12.25(font-size:12px): 6(length)*12/2 + 8(黑色刻度4+间距)
			xTextHalfWidth=settings.xAxis[0].length*.6*fontSize;	//*.6：本来是*.5，多加.1是为了增加间距，因为未必所有的数字、“-”都是字体大小的一半
			
			translateX=MathRound( yTextWidth-xTextHalfWidth>0 ? yTextWidth : xTextHalfWidth );
			mainWidth=svgWidth-translateX;
			main.attr('transform','translate('+translateX+',0)');
			
			while(i--){
				switch(i){
					case 0:		//上线
						d='M0 .5L'+mainWidth+' .5';
						break;
					case 1:		//下线
						d='M0 '+(mainHeight-.5)+'L'+mainWidth+' '+(mainHeight-.5);
						break;
					case 2:		//右线
						d='M'+(mainWidth-.5)+' 0L'+(mainWidth-.5)+' '+mainHeight;
						break;
					case 3:		//左线
						d='M.5 0L.5 '+mainHeight;
						break;
				}
				main.appendSE('path',{
					d: d,
					stroke: i%2 ? color.black : color.gray
				})
			}
			
			bgline=main.appendSE('g',{
				class: 'capi-bgline'
			});
			createBgLine(bgline, yNum, yOneSize, mainWidth);
			
			yAxisG=initYText(main, yNum, yOneSize, max, oneMean, fontSize, 
				settings.dataType == 'hotEvent' ? 1 : 0, {
				min: o.min,
				yHeight: yHeight,
				bgline: bgline,
				mainWidth: mainWidth,
			});
			
			return thisGlobal.add({
				xTextWidth: xTextHalfWidth*2,		//给xAxis提供接口
				translateX: translateX,				//对 flag 计算 x(第一个图标的x轴坐标) 提供接口
				mainWidth: mainWidth,				//mainWidth: svgWidth-yAxis数值的宽度
				mainHeight: mainHeight,
				bgline: bgline,
				yNum: yNum,
				yHeight: yHeight,
				yAxisG: yAxisG,
				DValue: DValue,
				max: max,
				min: min,
				color: color
			});
		},
		line:function(){
			var _this=this,
				thisGlobal=this.global,
				main=thisGlobal.main,
				mainWidth=thisGlobal.mainWidth,
				mainHeight=thisGlobal.mainHeight,
				DValue=thisGlobal.DValue,
				max=thisGlobal.max,
				settings=thisGlobal.settings,
				series=settings.series,
				strokeWidth=(thisGlobal.fontSize*.1).toFixed(1),
				
				colorGroup=['#F15C80','#90ED7D','#7CB5EC','#E5D55E','#8085E8','#91E8E1','#F7A35C','#8D4653','#74be6d','#be6da2'],
								//浅红，		浅绿，		浅蓝， 	浅黄，		浅紫，	浅蔚蓝，		浅橘，	略深红，	      略深绿，	   粉色
				lineG=createSE('g').attr({
					class:'capi-line',
					fill: 'none'
				}),
				dotG=createSE('g').attr({
					class:'capi-dot'
				}),
				colorStore=[],
				aDataLen=[],
				maxLen,
				oneLineWidth,
				scale;
			
			series.forEach(function(v){
				aDataLen.push( v.data.length )
			});
			maxLen=arrMax( aDataLen );	//data里 最多数据的一个数组的长度
			oneLineWidth=mainWidth/(maxLen-1); 		//一个line点所占的宽度
			//scale=(mainHeight-30)/DValue*.01;		//比值，数据所占用的实际高度
			scale=(mainHeight-30)/DValue*.01;		//比值，数据所占用的实际高度
			
			series.forEach(function(v,i){
				var dArr=[],
					start=0,
					width= v.width ? MathAbs(v.width) : strokeWidth,	//线段宽度（stroke-width）
					color=v.color ? v.color : colorGroup[i] ? colorGroup[i] : randomColor(),
					
					dotSmallG=dotG.appendSE('g',{	//圆点G
						fill: color
						
					}).data('index',i);		//存储圆点在series下的索引值，供hover获取内容时提供关联
					
				colorStore.push(color);
				
				v.data.forEach(function(sv,j){
					if(sv || sv=='0'){	//判断data的每个值是否为空，为空就跳过，执行下一个数值，data数值为 0 除外
						var s,
							x=MathFloor( oneLineWidth*j ) + .5,
							y=MathFloor( (max*100-sv*100)*scale ) + 29.5;	//要与灰色刻度线（bgline）保持一致，向下取整然后加.5
						
						isNaN(y) && (y=mainHeight*.1);		//当数据为0时，y计算成了NaN
						start ? s='L' : s='M', start=1;		//start=0表示数据断点， d 要重新 M 开始画
						dArr.push( s+x+' '+y );
						
					}else{
						start=0
					}
					
					dotSmallG.appendSE('circle',{
						cx: x ? x : 0,
						cy: y ? y : -999,	//处理断点，hover事件的兼容
						r: x ? (width*3).toFixed(2) : 0
					})
				});
				
				lineG.appendSE('path',{
					d: dArr.join(''),
					stroke: color,
					'stroke-width': width
				})
			});
			
			if( settings.dataType == 'hotEvent' ){
				main.append( lineG );
			}else{
				main.append( lineG, dotG );
			}
			
			return thisGlobal.add({
				lineG: lineG,	//对click事件提供接口
				dotG: dotG,		//对hover提供接口
				maxLen: maxLen,		//对xAixs提供接口
				oneLineWidth: oneLineWidth,
				colorStore: colorStore		//对 flag 提供接口
			});
		},
		/*xAxis:function(){		//自动匹配长度计算x轴显示日期个数
			var _this=this,
				thisGlobal=_this.global,
				svgHeight=thisGlobal.svgHeight,
				xAxis=thisGlobal.settings.xAxis,
				color=thisGlobal.color,
				fontSize=thisGlobal.fontSize,
				maxLen=thisGlobal.maxLen,
				main=thisGlobal.main,
				mainWidth=thisGlobal.mainWidth,
				oneLineWidth=thisGlobal.oneLineWidth,
				textWidth=thisGlobal.xTextWidth*1.6,	//宽度 = 文本宽度 + 间距宽度
				xNum=MathFloor( mainWidth/textWidth ),	//获得x轴(等于main的宽度)上能写最多有几个text
				xSpace=MathCeil( maxLen/xNum ),	//向上取整保证间距不会小
			
				xG=createSE('g').attr({
					class: 'capi-xaixs',
					'transform':'translate(0,'+(svgHeight-50)+')',
					'text-anchor': 'middle'
				}),
				
				i=0,
				x,
				n,
				text;
			
			xNum=maxLen/xSpace;	//最终x轴画的text个数
			//console.log(xNum)
			
			for(; i<xNum; i++){
				n=i*xSpace;
				
				x=MathFloor( n*oneLineWidth ) + .5;
				
				text=xAxis[ n ];
				
				i && xG.appendSE('path',{
						d: 'M'+x+' -.5v-4',
						stroke: color.black
					 });
					
				xG.appendSE('text',{
					x: x,
					y: (fontSize*1.14).toFixed(1)
					
				}).text( text ? text : i );
			}
			
			main.append( xG );
			
			return _this;
		},*/
		xAxis:function(){
			var _this=this,
				thisGlobal=_this.global,
				svgHeight=thisGlobal.svgHeight,
				xAxis=thisGlobal.settings.xAxis,
				color=thisGlobal.color,
				fontSize=thisGlobal.fontSize,
				main=thisGlobal.main,
				mainWidth=thisGlobal.mainWidth,
				oneLineWidth=thisGlobal.oneLineWidth,
				xSpace=thisGlobal.mainWidth/3,
			
				xG=createSE('g').attr({
					class: 'capi-xaixs',
					'transform':'translate(0,'+(svgHeight-50)+')',
					'text-anchor': 'middle'
				});
			
			function getX( i ){
				return MathFloor( MathRound( i*xSpace/oneLineWidth )*oneLineWidth ) + .5
			}
			
			var hotEvent = thisGlobal.settings.dataType == 'hotEvent';
			if( hotEvent ){
				xG.appendSE('path',{
					d: 'M'+getX( 1 )+' -.5v-'+(svgHeight-80),
					stroke: '#ccc',
					'stroke-dasharray': 6
				});
				xG.appendSE('path',{
					d: 'M'+getX( 2 )+' -.5v-'+(svgHeight-80),
					stroke: '#ccc',
					'stroke-dasharray': 6
				});
			}
			
			for(var i=0; i<4; i++){
				var num=MathRound( i*xSpace/oneLineWidth );
				var x=MathFloor( num*oneLineWidth ) + .5;
				var text=xAxis[ num ];
				
				i && xG.appendSE('path',{
						d: 'M'+x+' -.5v-4',
						stroke: color.black
					 });
					
				var textELem=xG.appendSE('text',{
					x: x,
					y: (fontSize*1.14).toFixed(1)
					
				});
				
				if(i==0){
					textELem.attr('text-anchor', 'start')
				}
				if(i==3){
					textELem.attr('text-anchor', 'end')
				}
				
				if( hotEvent ){
					
					if( i == 2 ){
						text = xAxis[ num + 1 ].substring( 0, 5 );
					}else if( i == 3 ){
						text = '';
					}else{
						text = text.substring( 0, 5 );
					}
				}
				
				textELem.text( text );
			}
			
			main.append( xG );
			
			return _this;
		},
		flag:function(){
			var _this=this,
				thisGlobal=_this.global,
				svgWidth=thisGlobal.svgWidth,
				svgHeight=thisGlobal.svgHeight,
				colorStore=thisGlobal.colorStore,
				fontSize=thisGlobal.fontSize,
				series=thisGlobal.settings.series,
				lineG=thisGlobal.lineG,
				dotG=thisGlobal.dotG,
				main=thisGlobal.main,
				mainWidth=thisGlobal.mainWidth,
				oneLineWidth=thisGlobal.oneLineWidth,
				translateX=thisGlobal.translateX,
				
				fG=createSE('g').attr({
					class: 'capi-flag',
					'transform':'translate(0,'+(svgHeight-fontSize/2-15)+')',	//[sh-30：整个的flag的y距离] + [(30-fsize)/2: 文字向下的偏移量]
					cursor: 'pointer'
				}),
				
				arr=[[],[]];	//二维数组里第一个数组存放图标G，第二个数组存放每个G的宽度
			
			function mc(n){
				return MathCeil( fontSize/n )
			}
				
			series.forEach(function(v,i){
				var name = v.name;
				
				if( thisGlobal.settings.dataType == 'hotEvent' ){
					if( v.data[ v.data.length - 1 ] ){
						var vdata = '：' + v.data[ v.data.length - 1 ];
					}else{
						var vdata = '    ';
					}
					name += vdata;
				}
				
				var g=fG.appendSE('g').data('index',i),
					x;
				
				g.appendSE('path',{	//flag
					d: 'M0 '+mc(3)+'L'+mc(.6)+' '+mc(3)+'L'+mc(.6)+' '+mc(2)+'L0 '+mc(2)+'ZM'+
						mc(2.4)+' 0L'+mc(.8)+' 0L'+mc(.8)+' '+mc(1.2)+'L'+mc(2.4)+' '+mc(1.2)+'Z',
					fill: colorStore[i]
				});
				
				g.appendSE('text',{
					x: mc(.5),
					y: mc(1.2)
					
				}).text( name );
				
				x=mc(.5)+name.length*fontSize;	//整个 g 的宽度：(icon的宽度 + 间距) + 文本宽度
				
				arr[0].push(g);
				arr[1].push(x)	//将每个g的宽度都添加到arr[1]里，用于后面的求和、加法计算
			});
			
			x=( svgWidth-(arrSum(arr[1]) + (arr[1].length-1)*10) )/2 - translateX;	//第一个flag G的x轴坐标， 因为g在main里面，所以要减去main的x轴偏移量
			
			arr[0].forEach(function(v,i){
				i && (x+=arr[1][i-1]+10)	//计算不同flag的x轴坐标值，第n个的flag的x轴坐标值，依次递加运算
				
				v.attr('transform', 'translate('+x+',0)')
			});
			
			//flag点击事件
			fG.on('click','g',throttle(function(){
				var curThis=$(this),
					index=curThis.data('index'),
					gray=curThis.data('gray'),
					path=$('path',curThis),
					text=$('text',curThis),
					
					serIndex=thisGlobal.serIndex;
				
				if( gray ){		//恢复
					path.attr('fill', colorStore[ curThis.index() ] );
					text.attr('fill', '#000' );
					
					$('path:eq('+index+')', lineG).attr('visibility','visiable');
					$('g:eq('+index+')', dotG).attr('visibility','visiable');
					
					thisGlobal.serIndex.push( index );	//向serIndex里添加要显示数据在series里的索引
					thisGlobal.serIndex.sort();			//排序，从小到大，以保持hover对应关联；[0,1,2,3...]
					
				}else{	//变灰
					path.add( text ).attr('fill','#ccc');
					//减少DOM重绘，find('rect, text').attr(...)会重绘g，而这里的不会重绘g，测试于chrome
					
					$('path:eq('+index+')', lineG).attr('visibility','hidden');	//让当前line隐藏
					$('g:eq('+index+')', dotG).attr('visibility','hidden');	//让当前dot隐藏
					
					thisGlobal.serIndex=serIndex.filter(function(v){	//向serIndex里删除不显示数据在series里的索引
						return v==index ? 0 : 1
					});
				}
				
				_this.draw(index);
				curThis.data('gray', !gray );
			},0,200));
			
			main.append( fG );
			
			return _this;
		},
		draw:function(index){
			var _this=this,
				thisGlobal=this.global,
				serIndex=thisGlobal.serIndex;
			
			function overtop(curData, maxMin){	//判断当前线段的是否是 最高或最低 线段
				var curMaxMin=arrMaximin( curData );	//当前数据的最大最小值
				
				if( curMaxMin.max>=maxMin.max || curMaxMin.min<=maxMin.min ){
					return 1
				}
				return 0
			}
			
			if(serIndex[0]===UNDEFINED){	//当serIndex为空时，说明没有要显示的数据，直接返回
				return
			}
			
			var series=thisGlobal.settings.series,
				showData=[],
				maxMin;
			
			serIndex.forEach(function(v){	//为showData创建值
				showData.push( series[v && v].data )
			});
			
			maxMin=arrMaximin( showData );	//所有显示数据的最大最小值
			
			if( overtop(series[index].data, maxMin) ){	//是最高或最低线段，需要改变其他线段d值
				var o=drawYText(		//绘制y轴
						thisGlobal.yAxisG,
						maxMin,
						thisGlobal.yHeight,
						thisGlobal.fontSize,
						thisGlobal.settings.dataType=='hotEvent' ? 'hotEvent' : '',
						{
							min: maxMin.min,
							yHeight: thisGlobal.yHeight,
							bgline: thisGlobal.bgline,
							mainWidth: thisGlobal.mainWidth
						}
					),
					yNum=o.yNum,
					yOneSize=o.yOneSize,
					bgline=thisGlobal.bgline;

				if(yNum!=thisGlobal.yNum){	//当重绘背景线段个数 等于 已经存在的背景线段个数时，不执行重绘
					$('g', bgline).remove();	//删除bgline下的g及line
					createBgLine(bgline, yNum, yOneSize, thisGlobal.mainWidth);		//重绘bgline下的g及line
					thisGlobal.yNum=yNum;
				}
				
				//绘制线段和圆点
				_this.drawLine(showData, serIndex, o.max, o.DValue)
			}
		},
		drawLine:function(showData, serIndex, max, DValue){
			var dArr=[],
				cArr=[],
				thisGlobal=this.global,
				lineG=thisGlobal.lineG,
				dotG=thisGlobal.dotG,
				oneLineWidth=thisGlobal.oneLineWidth,
				scale=(thisGlobal.mainHeight-30)/DValue*.01,		//比值，数据所占用的实际高度
				aPathLine,
				aDotG;
				
			showData.forEach(function(v){
				var cx=[],
					cy=[],
					d=[],
					start=0;
					
				v.forEach(function(sv,j){
					if(sv || sv=='0'){	//判断data的每个值是否为空，为空就跳过，执行下一个数值，data数值为 0 除外
						var s,
							x=MathFloor( oneLineWidth*j ) + .5,
							y=MathFloor( (max*100-sv*100)*scale ) + 29.5;	//要与灰色刻度线（bgline）保持一致，向下取整然后加.5
						
						start ? s='L' : s='M', start=1;		//start=0表示数据断点， d 要重新 M 开始画
						d.push( s+x+' '+y );
						
					}else{
						start=0
					}
					cx.push( x ? x : 0 );
					cy.push( y ? y : -999 );	//处理断点，hover事件的兼容
				});
				
				dArr.push( d.join('') );
				cArr.push( {cx: cx, cy: cy} )
			});
			
			aPathLine=$('path', lineG);
			aDotG=$('g', dotG);
			
			serIndex.forEach(function(v, i){
				/**
				 * 	dArr=[
				 * 		["M0.5 299.5L33.5 271.5L66.5 263.5L99.5 280.5L132.5..."]
				 * 		["M0.5 265.5L33.5 224.5L66.5 103.5L99.5 170.5L132.5..."]
				 * 		...
				 * 	]
				 * 
				 *	cArr=[
				 * 		{
				 * 			cx:[ 0.51, 33.52, 66.53, 99.54, 132.55, 165.56 ...]
				 * 			cy:[ 299.51, 271.52, 263.53, 280.54, 280.55, 271.56 ...]
				 * 		}
				 * 		{
				 * 			cx:[ 0.51, 33.52, 66.53, 99.54, 132.55, 165.56 ...]
				 * 			cy:[ 299.51, 271.52, 263.53, 280.54, 280.55, 271.56 ...]
				 * 		}
				 * 		...
				 * 	]
				 */
				//console.log( 'dArr: ', dArr, 'cArr: ', cArr )
				aPathLine.eq(v).attr('d', dArr[i]);
				
				aDotG.eq(v).find('circle').each(function(j){
					$(this).attr({
						cx: cArr[i].cx[j],
						cy: cArr[i].cy[j]
					})
				});
			});
		},
		hover:function(){
			var _this=this,
				thisGlobal=_this.global,
				svg=thisGlobal.svg,
				move=function(svg, thisGlobal){
					var settings=thisGlobal.settings,
						dataType = settings.dataType == 'hotEvent' ? 1 : 0,
						xAxis=settings.xAxis,
						series=settings.series,
						main=thisGlobal.main,
						w=thisGlobal.mainWidth,
						h=thisGlobal.mainHeight-30,
						mask=main.appendSE('rect',{
							width: w,
							height: h,
							fill: 'transparent',
							transform: 'translate(0,30)'
						}),
						
						box=thisGlobal.box,
						boxOffset=box.offset(),
						padding={
							left: pInt( svg.css('paddingLeft') ),
							top: pInt( svg.css('paddingTop') )
						},
						oneLineWidth=thisGlobal.oneLineWidth,
						halfLineWidth=(oneLineWidth/2).toFixed(2),
						
						flagText = svg.find('.capi-flag text'),
						
						dotG=thisGlobal.dotG,
						aTitText=thisGlobal.title.find('tspan'),
						old={},
						line;
					
					$WIN.on('resize.Linechart',throttle(function(){	//窗口改变，盒子距离相应改变
						boxOffset=box.offset()
						
					},100));	//处理window resize过快导致hover时old.dot为undefined报错，延时越小越好
					
					function common( i, e ){
						var	y=MathRound( e.pageY-boxOffset.top-padding.top ),	//鼠标到svg的距离
						
							arr=[[],[]],
							j=0,
							serIndex=thisGlobal.serIndex,
							len=serIndex.length,
							
							dotParent, dot, n;
						
						/**
						 *	将圆点添加到指定的arr里 
						 * 		arr[0] ->	圆点对象							[circle, circle, circle ...]
						 * 		arr[1] ->	鼠标与圆点对象的垂直距离				[99.51, 159.52, 116.5 ...]
						 */
						for(; j<len; j++){
							dotParent=$('g', dotG).eq( serIndex[j] );
							dot=$('circle:eq('+i+')', dotParent);
							
							if(dot.length){	//容错断点线段没有相应圆点的时候，跳过，不需要计算，只需要计算已存在的圆点距离，进行对比即可
								arr[0].push( dot );
								arr[1].push( MathAbs( y-dot.attr('cy') ) )
							}
						}
						
						n=arr[1].indexOf( arrMin( arr[1] ) );
						
						if(n==-1) return; 	//当有多条长短不一的线段时，长的线段隐藏，只剩下短的线段时，hover到短的线段之外（n=-1）的容错处理
						
						//console.log('arr: ', arr, 'arr[1]: ', arr[1], 'n: ', n)
						//console.log('serIndex: ', serIndex, 'serIndex[n]: ', serIndex[n])
						
						/**
						 * 	old.dot: 存储前个显示变大的圆点
						 * 	old.r： 存储恢复到初始值的圆点半径
						 */
						if(old.dot){
							old.dot.attr('r',old.r);	//让前个显示变大的圆点的半径恢复到初始值
							old.dot=arr[0][n];
							
						}else{	//第一次hover之前不存在old.dot，此else只会在hover第一次时执行
							old.dot=arr[0][n];			//存储圆点
							old.r=old.dot.attr('r')		//存储圆点半径初始值,window改变太快时attr获取不到
						}
						old.dot.attr('r', old.r*2);		//设置新圆点变大，并保存到old.dot里；点击flag后old.dot存储改变
						var conText=series[ serIndex[n] ].title[i];
						aTitText.eq(2).text( conText ? conText : '' );			//内容
					}
					
					function hotEvent( i ){
						for( var j = 0; j < 4; j++ ){
							if(series[ j ] && series[ j ].data[ i ]){
								flagText.eq( j ).text( series[ j ].name + '：' + series[ j ].data[ i ] + '%' );
							}else{
								flagText.eq( j ).text( series[ j ] ? series[ j ].name : '');
							}
						}
					}
					
					mask.on('mousemove', throttle(function(arg){
						if( !line ){
							//事件移动时的垂直线段，并缓存到上级作用域，于mouseout使用
							line = main.appendSE('path',{
								class: 'capi-tipline',
								d: 'M0 0 0 '+h,
								stroke: thisGlobal.color.black
							});
							
							if( !dataType ){
								dotG.before(line);
							}
						}
						
						var e=arg[0],
							i=MathRound(
								( e.pageX - boxOffset.left -
								padding.left - thisGlobal.translateX ) / oneLineWidth
							);
							//pageX-boxLeft-paddingLeft-translateX: 鼠标距离Y轴的距离
							//除以oneLineWidth: 得到大概的索引值；四舍五入即得到准确关联的索引值
							
						if( dataType ){
							hotEvent( i );
						}else{
							common( i, e );
						}
						
						var timeText=xAxis[i];
						aTitText.eq(1).text( timeText ? timeText : '' );		//时间
						
						line.attr({
							visibility: 'visible',
							transform: 'translate('+( MathFloor(oneLineWidth*i)+.5 )+',30)'
						});
						
						
					},0,52)).mouseout(function(){
						line && line.attr('visibility','hidden')	//window改变太快时处理
					})
				};
			
			svg.on('mouseover.charts',function(){
				move(svg, thisGlobal);
				$(this).off('mouseover.charts')
			})
		}
	};
	/******************************** Linechart END ************************************/
	
	function Kchart(box,Options){
		return this.init(box,Options)
	}
	
	function addPointFive(num){	//为元素值向下取整并加零点五，让元素显示不模糊 
		return MathFloor( num ) + .5
	}
	
	function addEllipsis(jud){	//判断大宗交易，内部交易，公告hover时文本是否添加省略号'...'
		return jud ? '...' : ''
	}
	/**
	 * 	创建事件icon，分别用于K线和分时图
	 */
	function createEvIcon(o,type){
		return 	'<div id="nid-'+o.nid+'" class="'+(type ? 'capi-ev-timeIcon' : 'capi-evIcon')+' capi-transition" data-'+(type ? 'istimechart' : 'iskchart' )+'-icon=1 title="'+o.title+
				'" style="left: '+(o.boxOffsetLeft+o.iconInSvgleft)+'px; top: '+(o.boxOffsetTop+o.iconInSvgTop)+'px;">'+
				o.iconHtml+'</div>';
	}
	function changeTop(showBox, $WinHeight, oInfo){	//改变删除加载动画的showBox的top值，使其居中显示，更好的视觉效果，如果用户拖拽了showBox就不改变top
		if(!showBox.data('changeTop')){
			var sum=oInfo.boxOffsetLeft+oInfo.translateX+10,
				width=showBox.outerWidth(),
				height=showBox.outerHeight(),
				left=pInt( showBox.css('left') ),
				top=pInt( showBox.css('top') );
				
			if($WinHeight<height+top){
				showBox.css('top', $WinHeight-height-40);
			}
			
			if(oInfo.loadingLeft && sum<width+left){
				showBox.css('left', sum-width-20);
			}
		}
	}
	function loadingImg(showBox, url, $WinHeight, oInfo){	//加载K线分时图
		var loading=$(GLOBAL.loadingHtml),
			oImg=new Image();
		
		showBox.append( loading );
		oImg.src=url;
		oImg.onload=function(){
			loading.remove();
			showBox.append( '<img src="'+url+'" alt="">' );
			changeTop(showBox, $WinHeight, oInfo);
			loading=oImg=null;	//释放内存?
		}
	}
	function getComment(nid, comment){//获取评论内容
		$.ajax({
			url: siteUrl+'news/loadcomment/'+nid,
			dataType: 'json'
			
		}).done(function(msg){
			var aLi='';
			
			if(msg.sum){
				for(var key in msg.comments[0]){
					var firstObj=msg.comments[0][key],
						comLength=0,
						secCon='';
					
					for(var secKey in msg.comments[key]){
						var secObj=msg.comments[key][secKey];
						secCon+='<li>'+
				    				'<div class="user">'+
										'<div class="content">'+
								    		'<p class="blue-text">'+secObj.nickname+(secObj.toNickname ? ' 回复 '+secObj.toNickname : '')+'</p>'+
								    		'<div>'+secObj.content+'</div>'+
								    		'<div class="clearfix reply-time">'+
								    			'<time class="fl">'+secObj.addtime+'</time>'+
								    			'<span id="show-'+secKey+'" class="fr">回复</span>'+
								    		'</div>'+
								    	'</div>'+
								    	'<div id="reply-'+secKey+'" class="reply-user lightgray-bg-color">'+
							    			'<div>'+
							    				'<textarea class="form-control"></textarea>'+
							    				'<div>'+
							    					'<i class="btn btn-default" data-newsId="'+nid+'" data-replay="'+secKey+'" data-type="2">回复</i>'+
							    				'</div>'+
							    			'</div>'+
								    	'</div>'+
									'</div>'+
				    			'</li>';
				    	comLength++;
					}
					
					aLi+='<li class="wrap">'+
							'<div class="content">'+
					    		'<p class="blue-text">'+firstObj.nickname+(firstObj.toNickname ? ' 回复 '+firstObj.toNickname : '')+'</p>'+
					    		'<div>'+firstObj.content+'</div>'+
					    		'<div class="clearfix reply-time">'+
					    			'<time class="fl">'+firstObj.addtime+'</time>'+
					    			'<span id="show-'+key+'" class="fr">回复('+comLength+')</span>'+
					    		'</div>'+
					    	'</div>'+
					    	
					    	'<div id="reply-'+key+'" class="reply-user lightgray-bg-color">'+
				    			'<div>'+
				    				'<textarea class="form-control"></textarea>'+
				    				'<div>'+
				    					'<i class="btn btn-default" data-newsId="'+nid+'" data-replay="'+key+'" data-type="1">回复</i>'+
				    				'</div>'+
				    			'</div>'+
					    		'<ol class="user-sec">'+secCon+'</ol>'+
					    	'</div>'+
					     '</li>';
				}
			}
			
			var con='<div class="comment-submit">'+
						'<p class="bold">评论（'+msg.sum+'）</p>'+
						'<textarea class="form-control" placeholder="发表评论，至少输入5个字"></textarea>'+
						'<div class="align">'+
							'<span class="btn btn-default" data-newsId="'+nid+'" data-replay="0" data-type="0">发布</span>'+
						'</div>'+
					'</div>'+
					'<ul class="comment-list">'+aLi+'</ul>';
			
			$('.capi-loading-svg',comment).remove();
			comment.append($(con));
		});
	}
	function setEvCon(conWrap,con,showBox,comment,$WinHeight, oInfo){
		$('.capi-loading-svg',conWrap).remove();
		conWrap.append( con ).css('height','auto');
		
		var conWrapHeight=conWrap.outerHeight();
		if(conWrapHeight > 320){ 	//压缩内容高于评论高的时候，设置盒子高度
			showBox.css('height',showBox.outerHeight());
			//comment.css('height',conWrapHeight);
		}else{	//设置footer到conWrap底部
			$('footer',conWrap).addClass('capi-pos-footer');
			showBox.css('height',340);
		}
		changeTop(showBox, $WinHeight, oInfo);
	}
	
	$DOC.on( 'click.evInfo', '.capi-gly-com', throttle(function(){
		var that = $( this ),
			show = that.data( 'show' ),
			parent;
		
		if( that.parents('.capi-ev-timeInfo').length ){
			parent = that.parents('.capi-ev-timeInfo');
		}else{
			parent = that.parents('.capi-evInfo');
		}
		
		if( show ){
			parent.find('.capi-comment').remove();
			parent.css( 'width', 430 );
			that.html('▶' ).attr('title','展开评论');
		}else{
			var comment = $('<div>').attr('class','capi-comment fl')
				.append( GLOBAL.loadingSVG );
				
			parent.append( comment ).css('width', 654 );
			that.html('◀' ).attr('title','收起评论');
			
			getComment( that.attr( 'data-nid' ), comment );
		}
		
		that.data( 'show', !show );
	}, 0, 100 ));
	
	function loadingArticle(_this, showBox, $WinHeight, oInfo){	//加载压缩内容
		var con=_this.data('con'),
			nid=_this.attr('id').substring(4),
			conWrap=$('<div>').attr('class','capi-con-wrap fl');
			//comment=$('<div>').attr('class','capi-comment fl');
			
		//conWrap.add(comment).append( GLOBAL.loadingSVG );
		//showBox.append(conWrap, comment);
		conWrap.append( GLOBAL.loadingSVG );
		showBox.append('<span class="capi-gly-com" data-nid="'+nid+'" title="展开评论">▶</span>')
			.append(conWrap);
		
		if( con ){
			showBox.css( 'width', 430 );
			setEvCon(conWrap, con, showBox, 'comment', $WinHeight, oInfo);
			//setEvCon(conWrap, con, showBox, comment, $WinHeight, oInfo);
			//getComment(nid,comment);
		}else{
			/**
			 * 	获取压缩内容
			 * 	sina分享与微信分享的函数在global.js里面
			 */
			$.ajax({
				url: siteUrl+'news/loadpoint/'+nid+(stkCode ? '/'+stkCode : ''),	//stk_url: 在html页面的全局变量
				dataType: 'json'
				
			}).done(function(msg){
				var content='<header class="capi-title">'+oInfo.title+'</header>'+
					'<p class="time">'+
						'<time>'+msg.time+'</time>来源：'+msg.from+
						'<a class="sina" href="javascript:;" title="分享到新浪" onclick="share(\''+oInfo.title+'\',\''+siteUrl+'news/view/'+nid+(stkCode ? '/'+stkCode : '')+'\')"></a>'+
						'<a class="weixin" href="javascript:;" title="分享到微信" onclick="weixinCodeToggle(this)">'+
							'<img src="'+siteUrl+'captchas/qr?url=www.yuncaijing.com/touch/news/view/'+nid+'" alt="">'+
						'</a>'+
					'</p>'+
					'<div class="content uglify-arcticle">'+msg.description+'</div>'+
					'<footer>'+
						'以上内容已经经过压缩处理，查看全文请 &nbsp;<a href="'+msg.source_url+'" target="_blank">点击这里</a>'+
					'</footer>';
				
				setEvCon(conWrap, content, showBox, 'comment', $WinHeight, oInfo);
				//setEvCon(conWrap, con, showBox, comment, $WinHeight, oInfo);
				_this.data('con', content);
				
			}).done(function(){	//获取评论
				//getComment(nid,comment)	//3025379
			})
		}
	}
	function stkBigValFormat(val,limit){	//格式化金额
	    var ret = 0;
	    val /= (limit || 1);
	    
	    if(val >= 100000000 || val <= (-100000000) ){
	        ret = MathRound(val/100000000) + '亿';
	    }else if(val >= 10000 || val <= (-10000) ){
	        ret = MathRound(val/10000) + '万';
	    }else{
	        ret = MathRound(val);
	    }
	
	    return ret;
	}
	
	var textColor=function(){
		var red='red-text',
			green='green-text',
			black='black-text';
		return function (val){
			return val > 0 ? red : val == 0 ? black : green
		}
	}();
	
	var rateLHB=function(){
		var empty='--',
			//serves='<a href="'+siteUrl+'apply/app_details/6">需购买服务</a>';
			serves='<i class="gray-text">需购买服务</i>';
		return function(rights,val){
			var result='';
			
			if( val ){
				if( val.full ){
					for(var i=0; i<val.full; i++){
						result += '<mark class="full-star"></mark>'
					}
				}
				if( val.halffull ){
					for(var i=0; i<val.halffull; i++){
						result += '<mark class="halffull-star"></mark>'
					}
				}
				if( val.hollow ){
					for(var i=0; i<val.hollow; i++){
						result += '<mark class="hollow-star"></mark>'
					}
				}
			}else{
				result=empty;
			}
			return result;
			//return rights ? (val ? val : empty) : serves
			//return val ? val : empty
		}
	}();
	var rateLHBTit=function(rights, star_t, rank_t, buyall){
		//rateLHB(rights, msg.star_t1)+'<i class="red-text">（'+ (msg.star_t1 ? msg.star_t1.lv : nullText) +'）</i>'
		if( rights ){
			return '<span class="bold" title="'+rank_t+'">'+rateLHB(rights, star_t)+'<i class="red-text">（'+ (star_t ? star_t.lv : '--') +'）</i></span>'
		}else{
			return '<a href="'+siteUrl+'apply/app_details/10" target="_blank">需购买高级席位数据（新）</a>'
		}
	};
	
	function loadingLHB(_this, showBox, $WinHeight, oInfo){
		var	dataCon=_this.data('con');
		if(dataCon){
			showBox.append(dataCon);
		}else{
			var loading=$(GLOBAL.loadingSVG);
			showBox.append(loading);
			
			$.ajax({
				url: siteUrl+'datacenter/coms_mingxi_modal/'+stkCode+'/'+_this.data('data').requireTime+'/2',
				//url: siteUrl+'datacenter/coms_mingxi_modal/600769/2015-08-21/2',
				dataType: 'json'
			}).done(function(msg){
				var nullText='--';
				var rights=msg.booksvr6;
				
				var header= '<div class="clearfix header">'+
			                    '<span>净买金额：'+stkBigValFormat( msg.netamount*10000 )+'</span>'+
			                    '<span>总买入金额：'+stkBigValFormat( msg.buyall*10000 )+'</span>'+
			                    '<span>总卖出金额：'+stkBigValFormat( msg.sellall*10000 )+'</span>'+
			                '</div>';
			    if( msg.increase < 9){
			    	header += '<div>仅对涨幅大于9%的个股评级。</div>'
			    }else{
			    	
			    	if( rights && msg.buyall <= 1000 ){
				    	header += '<div>当日龙虎榜成交额过低，不纳入席位短线、中线评级。</div>'
				    	
				    }else{
				    	header += '<div>'+
		                	'<small class="malign bold">席位短线评级：</small>'+rateLHBTit(rights, msg.star_t1, msg.rank_t1)+
		                	'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+
		                	'<small class="malign bold">席位中线评级：</small>'+rateLHBTit(rights, msg.star_t5, msg.rank_t5)+
		                '</div>';
				    }
			    	
			    }
			                
				var contentWrap=header+'<p class="bold sub-title">买入端</p>';
				var com=msg.com;
				var buyCon=[];
				var sellCon=[];
				var reCon=[];
				var empty='--';
				
				msg.lhb.forEach(function(v,i){
					var sig=v.sig;
					var amoType='未知';
					var freq=com[v.comcode].freq;
					var comType=com[v.comcode].type;

					if(v.com=='机构专用'){
						amoType='机构席位';
					}else{
						//if(freq!=empty && comType!=empty){
						//	amoType=(freq=='一般' ? '不活跃' : freq) +'的'+comType;
						//}
						if(comType!=empty){
							if(freq!=empty){
								amoType=(freq=='一般' ? '不活跃' : freq)+'的'+comType;
							}else{
								amoType=comType;
							}
						}
					}
					
					var fillUp='<span>'+stkBigValFormat( v.netamount*10000 )+'</span>';
					if(sig=='sfl'){
						var stkBuyAmo=stkBigValFormat( v.buyamount*10000 ),
							stkSellAmo=stkBigValFormat( v.sellamount*10000 );
							
						fillUp='<span title="'+stkBuyAmo+'">'+stkBuyAmo+'</span>'+
	                           '<span title="'+stkSellAmo+'">'+stkSellAmo+'</span>';
					}
					
					var str='<li class="clearfix">'+
	                            '<span class="blue-text"><a class="msg-tooltip" href="'+siteUrl+'comd/index/'+v.url+'" data-original-title="" target="_blank" title="'+v.com+'">'+v.com+'</a></span>'+
	                            '<span title="'+(v.star_t1 ? v.rank_t1+'（'+v.star_t1.lv+'）' : nullText)+'"><small class="malign">&nbsp;</small>'+rateLHB(rights, v.star_t1)+'</span>'+
	                            '<span title="'+(v.star_t5 ? v.rank_t5+'（'+v.star_t5.lv+'）' : nullText)+'"><small class="malign">&nbsp;</small>'+rateLHB(rights, v.star_t5)+'</span>'+
	                            '<span title="'+amoType+'">'+amoType+'</span>'+
	                            fillUp+
	                        '</li>';
	                        
					if(sig=='buy'){
						buyCon.push( str );
					}else if(sig=='sell'){
						sellCon.push( str );
					}else{
						reCon.push( str );
					}
				});
				contentWrap+='<div class="list"><ul>'+
								'<li class="clearfix bold-title">'+
		                            '<span>营业部名称</span>'+
		                            '<span>短线评级</span>'+
		                            '<span>中线评级</span>'+
		                            '<span>资金类型</span>'+
		                            '<span>净额</span>'+
		                        '</li>'+
		                        buyCon.join('')+
		                    '</ul></div>'+
		                    '<p class="bold sub-title">卖出端</p>'+
		                    '<div class="list"><ul>'+
		                    	sellCon.join('')+
		                    '</ul></div>';
				
				if(reCon.length){
					contentWrap+='<p class="bold sub-title">对倒</p>'+
                				 '<div class="list sfl"><ul>'+
                				 '<li class="clearfix bold-title">'+
	                				 '<span>营业部名称</span>'+
	                				 '<span>短线评级</span>'+
	                				 '<span>中线评级</span>'+
	                				 '<span>资金类型</span>'+
	                				 '<span>买入</span>'+
	                				 '<span>卖出</span>'+
                				 '</li>'+reCon.join('')+'</ul></div>';
				}
				
				contentWrap='<div class="content capi-lhbang">'+contentWrap+'</div>';
				
				loading.remove();
				showBox.append(contentWrap);
				changeTop(showBox, $WinHeight, oInfo);
				_this.data('con',contentWrap);
			})
		}
	}
	function createShow(title, con, _this, dragLine, oInfo, type){
		var $WinWidth=oInfo.$WinWidth,
			$WinHeight=oInfo.$WinHeight,
			boxOffsetLeft=oInfo.boxOffsetLeft,
			boxOffsetTop=oInfo.boxOffsetTop,
			translateX=oInfo.translateX,
			translateY=oInfo.translateY,
			
			showBox,
			close,
			divWidth,
			divHeight,
			divLeft,
			divTop,
			dValX,
			dValY,
			className;
		
		switch(type){
			case 0:		//内部交易，大宗交易
				className='trade';
				oInfo.lhb && (className+=' capi-win-lhb');
				break;
			case 1:		//K线弹出分时图
				className='timeChart';
				break;
			case 2:		//事件内容压缩 展示
				className='evInfo';
				break;
			case 3:		//公告
				className='notice '+_this.attr('id');
				break;
		}
		if(type==2){
			showBox=_this.attr({
				class: oInfo.type ? 'capi-ev-timeInfo' : 'capi-evInfo',
				title: ''
			}).html('');
		}else{
			showBox=$('<div>').attr('class','capi-'+className);
			if(oInfo.isMarket){
				showBox.addClass('capi-market');
			}
		}
		
		close=$('<i>').attr('class','capi-close').appendTo(showBox);
		type!=2 && showBox.append( title );
		if(type==1){	//K线弹出分时图
			loadingImg( showBox, con, $WinHeight, oInfo );
			
		}else if(type==2){	//事件内容压缩 展示
			loadingArticle(_this, showBox, $WinHeight, oInfo);
			$('#evt-'+showBox.attr('id').substring(4)).data('show', 1);	//使右侧event里的li点击可关闭
			
		}else if(con=='lhb'){	//龙虎榜
			loadingLHB(_this, showBox, $WinHeight, oInfo);
			
		}else{	//内部交易，大众交易，公告
			showBox.append( con );
		}
		$BODY.append( showBox );
		
		divWidth=showBox.outerWidth();
		divHeight=showBox.outerHeight();
		divLeft=boxOffsetLeft+translateX+10;	//弹窗在元素左边
		divTop=boxOffsetTop+translateY-40;
		
		if($WinWidth-divWidth<divLeft){
			divLeft=boxOffsetLeft+translateX-divWidth-10;
			oInfo.loadingLeft=1;				//供loading时change showBox left
		}
		
		if($WinHeight-divHeight<divTop){
			divTop=$WinHeight-divHeight-40;
		}
		
		
		if(!type){
			if(!_this.data('data') /*&& !_this.data('data').lhb*/){
				showBox.css('width', divWidth+1)	//大宗交易文本内存在特殊符号时，width计算会有1px的误差
			}
		}
		
		showBox.css({
			left: divLeft,
			top: divTop,
			zIndex: GLOBAL.zIndex
			
		}).capiDrag({		//拖拽svg线段
			move: function(divLeft, divTop){
				dragLineMove(divLeft, divTop);
				!showBox.data('changeTop') && showBox.data('changeTop',1);	//用于判断是否在loading动画结束时改变showBox的top值，用户移动了表示不改变
			}
		});
		
		dValX=divWidth*.4-boxOffsetLeft-translateX;	//设置拖拽线的端点距离浮动div的左右侧为自身宽高的40%左右
		dValY=divHeight*.36-boxOffsetTop-translateY;
		
		dragLineMove(divLeft, divTop);	//初始化拖拽线段
		
		close.on('click.charts',function(){
			if(type==2){
				_this.attr({
					class:'capi-evIcon capi-transition',
					title: oInfo.title
				}).css({
					left: oInfo.oldLeft,
					top: oInfo.oldTop,
					zIndex: 9,
					height: 'auto',
					width: '20px'
				}).html( oInfo.oldHtml );
				dragLine.attr('d', oInfo.oldDragLine_d);
				
				$('[data-capi-evt='+showBox.attr('id').substring(4)+']').data('show', 0);	//恢复右侧event里的li可点击事件
				if( oInfo.type ){
					_this.attr('class','capi-ev-timeIcon capi-transition')
				}
			}else{
				showBox.add(dragLine).remove();		//优化： 最好是不删除直接修改d属性
				_this.data('show',0);	//让交易图标恢复可点击状态
				dragLineMove=null;	//因为这些是删除的，所以可以清空此函数，而icon的拖拽不是这样的做法，不应该清空，否则找不到函数
				if(type==3){
					$('[data-capi-notice='+_this.attr('id').substring(7)+']').data('show',0);	//回复公告可点击事件
				}
			}
			dValX=dValY=null;	//释放内存资源，防止内存泄露，其实目前还清理的不彻底
		});
		showBox.on('dblclick.charts',function(e){
			if( e.target.getAttribute('class')=='capi-gly-com' ){
				return
			}
			if(e.target.tagName.toLowerCase()!='textarea'){
				close.trigger('click.charts')
			}
		});
		
		function dragLineMove(divLeft, divTop){
			var l=(divLeft+dValX).toFixed(1),
				t=(divTop+dValY).toFixed(1);
			dragLine.attr( 'd','M0 0L'+l+' '+t );
		}
	}
	function createTimeShow(_this, dragLine, oInfo){
		var code=oInfo.stock[1],
			time=oInfo.time,
			title=	'<header class="capi-title">'+
						'<span>'+oInfo.stock[0]+'('+code+') 分时图</span>'+
						'<time>'+time+'</time>'+
					'</header>',
			url='http://www.yuncaijing.com/stock/paintline/'+code+'/'+time;
		
		createShow(title, url, _this, dragLine, oInfo, 1);	//创建展示内容公共函数
	}
	function createTradeShow(_this, type, dragLine, oInfo, lhb){
		var tradeData=_this.data('data'),
			con=[],
			content,
			header;
			
		if( type ){	//type: 1(大宗交易) : 0(内部交易)
			type='大宗';
			tradeData.big.forEach(function(v){
				con.push('<div class="content">'+
							'<p>成交价格：'+v.price+' &nbsp;&nbsp; 成交量：'+v.vol+' &nbsp;&nbsp; 成交金额：'+v.sum+'</p>'+
							'<p>买方营业部：<a target="_blank" href="'+siteUrl+'comd/index/'+v.buyerUrl+'">'+v.buyer+'</a></p>'+
							'<p>卖方营业部：<a target="_blank" href="'+siteUrl+'comd/index/'+v.vendorUrl+'">'+v.vendor+'</a></p>'+
						 '</div>');
			});
		}else{
			if(!lhb){
				type='内部';
				if(tradeData.buy){	//数据中存有买入就是内部买入交易
					tradeData.buy.forEach(function(v){
						con.push( '<p>'+v+'</p>' );
					});
				}else{	//否则是内部卖出交易
					tradeData.sell.forEach(function(v){
						con.push( '<p>'+v+'</p>' );
					});
				}
				con=['<div class="content">'+con.join('')+'</div>'];
			}
		}
		
		if(lhb){
			header='<header class="capi-title">'+tradeData.time+'龙虎榜数据：'+tradeData.title+'</header>';
			content='lhb';
		}else{
			header='<header class="capi-title">'+tradeData.time+' '+type+'交易数据</header>';
			content=con.join('');
		}
		
		createShow(	//创建展示内容公共函数
			header,
			content,
			_this,
			dragLine,
			oInfo,
			0
		);
	}
	
	Kchart.prototype={
		init:function(box,Options){
			var settings=$.extend(true,{
					style: {
						font: '12px "\\5FAE\\8F6F\\96C5\\9ED1"',
						overflow: 'hidden',
						'box-sizing': 'border-box',
					},
					title:'K线图(日)',
					stock: [],
					dynamic: 0,	//不是实时更新时段
					hasBar: 0,	//是否显示成交量的柱状图，0表示不显示
					xAxis: [],
					series: {}
				},Options),
			
			svg=box.appendSE('svg',{
				width:'100%',
				height:'100%',
				xmlns:SVG.ns
				
			}).css(settings.style),
			
			svgWidth=svg.width(),
			svgHeight=svg.height(),
			yHeight=svgHeight-50,	//20（xAxis）+ 30（title）
			fontSize=pInt( svg.css('font-size') ),
			
			xLength,
			xInLen,
			main,
			k,
			title;
			
			if( svgWidth<10 || svgHeight<80 ) return svg.remove();	//当盒子宽高不够以无法显示图形时，不绘图
			/******************* 以上基本参数配置 *****************************/
			
			main=createSE('g').attr( 'class','capi-main' );	//创建整体
			
			xLength=settings.xAxis.length;	//x轴数据长度
			xInLen=xLength-1;	//索引长度
			data=settings.series.data;
			
			title=createTitle(
				fontSize,
				main,
				[
					settings.title,	//标题
					settings.xAxis[xInLen],	//日期
					'开：',
					data[xInLen][0],
					'高：',
					data[xInLen][1],
					'低：',
					data[xInLen][2],
					'收：',
					data[xInLen][3],
					'量：',
					formatVol( data[xInLen][4] ),
					'幅：',
					data[xInLen][5]
				]
			);
			
			var _this=this;
			_this.global={
				box: box,
				svg: svg,
				settings: settings,
				svgWidth: svgWidth,
				svgHeight: svgHeight,
				yHeight: yHeight,
				fontSize: fontSize,
				xLength: xLength,
				xInLen: xInLen,
				main: main,
				title: title,
				kColor: {
					gray: '#ccc'
				},
				add:function(o){
					return $.extend(this,o), _this;
				}
			};
			
			with(_this){
				var hasBar=settings.hasBar;
					
				grid();
				createMaTitle();
				kInit();
				xAxis();
				createK();
				ma();
				trade();
				notice();
				
				hasBar && bar();
				hasBar && chartBottom();
				
				dynamic();
				hover();
				maClick();
				icon();
				tradeClick();
				kClick();
				noticeClick();
			}
			svg.append( main );	//所有执行完毕，将整体添加到svg中
			
			return _this;	//返回当前对象供update时用
		},
		grid:function(){
			var thisGlobal=this.global,
				series=thisGlobal.settings.series,
				main=thisGlobal.main,
				mainWidth=thisGlobal.svgWidth,
				kData=series.data,
			
				arr=[],		//K线数据
				maxMin,
				bgline;
				
			kData.forEach(function(v){
				arr.push( v[1] );		//最高价
				arr.push( v[2] );		//最低价
			});
			
			maxMin=arrMaximin( [arr, series.ma5, series.ma10, series.ma20, series.ma30 ] );
			
			
			bgline=main.appendSE('g',{
				stroke: thisGlobal.kColor.gray,
				'stroke-dasharray': 6
			});
			
			//createKBgLine
			;(function(bgline){
				var num = MathFloor( thisGlobal.yHeight/50 ),
					size = MathFloor( thisGlobal.yHeight/num ),
					i = 0,
					y,
					pathLine;
					
				for( ; i < num; i++ ){
					y = addPointFive( i*size ) + 29;
					
					pathLine=bgline.appendSE('path',{
						d: 'M1 '+y+'L'+mainWidth+' '+y
					});
					
					//让第一条线段不继承父级的dash属性
					i || pathLine.attr('stroke-dasharray',0);
				}
			})(bgline);
			
			return thisGlobal.add({
				bgline: bgline,
				max: maxMin.max,
				min: maxMin.min
			})
		},
		createMaTitle:function(){
			var _this=this,
				thisGlobal=_this.global,
				series=thisGlobal.settings.series,
				xInlen=thisGlobal.xInLen,
				maColor=['#E96D6D','#36A3DC','#C9A811','#1966AE'],	//均线颜色，从5、10、20、30依次算起
				text=[
						'MA5：', series.ma5[xInlen],
						'MA10：', series.ma10[xInlen],
						'MA20：', series.ma20[xInlen],
						'MA30：', series.ma30[xInlen]
					],
					
				o=_this.modal_bottomTit(
					thisGlobal.main,
					maColor,
					text
				);
			
			o.textElem.attr('y', 46);	//modal_bottomTit设置text的默认y值为16，而ma的值应为46
			
			return thisGlobal.add({
				maTitle: o.textElem,
				allMaTspan: o.allTspan,
				maColor: maColor
			})
		},
		xAxis:function(){
			var _this=this,
				thisGlobal=_this.global,
				main=thisGlobal.main,
				bgline=thisGlobal.bgline,
				svgHeight=thisGlobal.svgHeight,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				xAxis=thisGlobal.settings.xAxis,
				fontSize=thisGlobal.fontSize,
				grayColor=thisGlobal.kColor.gray,
				
				xTranslateY=svgHeight-19.5,
				xG=createSE('g').attr('transform', 'translate(0,'+xTranslateY+')'),
				
				textG;
			
			xG.appendSE('path',{	//上横线，分界线
				d: 'M0 0 '+thisGlobal.svgWidth+' 0',
				stroke: grayColor
			});
			
			textG=xG.appendSE('g',{
				transform: 'translate(0,14)',
			});
			
			var space=MathRound(thisGlobal.xLength/3),	//计算4个x轴日期的间距
				i=0,
				x,
				textAnchor,
				text;
			
			for(; i<4; i++){
				switch(i){
					case 0:
						x=0;
						text=xAxis[0];
						textAnchor='start';
						break;
					case 3:
						x=thisGlobal.svgWidth;
						text=xAxis[ thisGlobal.xInLen ];
						textAnchor='end';
						break;
					default:
						x=thisGlobal.kx( space*i )+halfOneKWidth;
						text=xAxis[ space*i ];
						textAnchor='middle';
						bgline.appendSE('path',{
							d: 'M'+x+' 29.5 '+x+' '+xTranslateY
						});
				}
				
				textG.appendSE('text',{
					x: x,
					'text-anchor': textAnchor
					
				}).text( text ? text : '' );
			}
			
			main.append( xG );
			return _this;
		},
		kInit:function(){
			var thisGlobal=this.global,
				svgHeight=thisGlobal.svgHeight,
				svgWidth=thisGlobal.svgWidth,
				
				series=thisGlobal.settings.series,
				trade=series.trade,
				k=series.data,
				
				max=thisGlobal.max,
				min=thisGlobal.min,
				kHeight=svgHeight-70,	//30 title + 20 ma-title + 20 xAxis, 没有大宗交易的数据时的高度，有交易要减去交易的高度
				kTranslateY=50,	//30title + 20 ma-title
			
				oneKWidth=svgWidth*.76/thisGlobal.xLength,
				oneSpaceWidth=svgWidth*.24/thisGlobal.xInLen,
				
				halfOneKWidth,
				tradeScale,	//trading icon默认宽度为10，*.1就是缩放的比例
				barHeight,
				ky;
			
			if(oneKWidth>20){	//处理单个K线的宽度太宽
				oneKWidth=20;
			}
			
			if(oneSpaceWidth>16){
				oneSpaceWidth=16;
			}
			
			if(thisGlobal.settings.hasBar){
				if(thisGlobal.settings.indexType!=UNDEFINED){
					var chartBottomHeight=kHeight*.2;		//MACD
					barHeight=kHeight*.2;
					kHeight*=.6;
					
				}else{	//四大指数兼容
					barHeight=kHeight*.22;
					kHeight*=.78;
				}
			}
			
			if(series.notice[0]){
				var noticeHeight=oneKWidth+2;
				kHeight-=noticeHeight;	//2：留下2px的上下间隙
				kTranslateY+=noticeHeight;
			}
			
			ky=function(){
				var scale=kHeight/(max-min);
				return function(curNum){
					return MathFloor( (max-curNum) * scale )
				}
			}();
			
			halfOneKWidth=MathFloor( oneKWidth/2 );
			tradeScale=(MathCeil( oneKWidth )*.1).toFixed(2);
			
			if(trade[0]){	//判断内部交易，大宗交易是否存在，存在才重新计算K的高
				var tradeHeight=[[],[]];
				trade.forEach(function(v){
					var tradeNum=0;
					var sumHeight=0;	//一个K线下有多少个交易数据,tradeHeight用于计算不同icon的高度
					
					if(v.buy){
						tradeNum++;
					}
					if(v.sell){
						tradeNum++;
					}
					sumHeight=tradeNum*6*tradeScale;
					
					if(v.big){
						tradeNum++;
						sumHeight+=8*tradeScale;
					}
					if(v.lhbang){
						tradeNum++;
						sumHeight+=10*tradeScale;
					}
					
					tradeHeight[0].push( v.index );
					tradeHeight[1].push( tradeNum*5+sumHeight );
				});
				
				var hasTradeKLowHeight=[];
				tradeHeight[0].forEach(function(v){
					hasTradeKLowHeight.push( ky(k[v][2]) )
					/**
					 * 	k[v][2]就是k数据里的第v个k数据的最小值
					 */
				});
				
				var maxTradeKHeight=[];
				hasTradeKLowHeight.forEach(function(v,i){
					maxTradeKHeight.push( v+tradeHeight[1][i] )
				});
				
				maxTradeKHeight=arrMax( maxTradeKHeight );
				
				var dv=maxTradeKHeight-kHeight;
				if(dv>0){
					kHeight-=dv;
				}
				/**
				 * 	kHeight=kHeight-(maxTradeKHeight-kHeight);
				 */
				//console.log('end_kHeight: ', kHeight)
			}
			
			if(trade[0]){
				ky=function(){	//重新修改ky，其实就是修改kHeight的值
					var scale=kHeight/(max-min);
					return function(curNum){
						return MathFloor( (max-curNum) * scale )
						//(max-curNum)/(max-min) * kHeight
					}
				}();
			}
			
			var dragLineG=thisGlobal.bgline.appendSE('g',{	//整个var都是配置
					stroke: '#333',
					'stroke-dasharray': 0
				}),
				box=thisGlobal.box,
				offset=box.offset(),
				$winSet={
					width: $WIN.width(),
					height: $WIN.height()
				};
				
			$WIN.on('resize.Kchart',throttle(function(){	//窗口改变，盒子距离相应改变，引用地址时用
				var os=box.offset();
				offset.left=os.left;
				offset.top=os.top;
				$winSet.width=$WIN.width();
				$winSet.height=$WIN.height();
			},100));
			
			var barTranslateY=MathFloor( kTranslateY+kHeight+(dv>0 ? dv : 0) );
			
			return thisGlobal.add({
				offset: offset,
				$winSet: $winSet,
				dragLineG: dragLineG,
				chartBottomHeight: chartBottomHeight,
				barTranslateY: barTranslateY,
				barHeight: barHeight,
				kTranslateY: kTranslateY,
				kHeight: kHeight,
				oneKWidth: oneKWidth,
				halfOneKWidth: halfOneKWidth,
				oneSpaceWidth: oneSpaceWidth,
				tradeScale: tradeScale,
				k: k,
				ky: ky,
				kx: function(index){
					return addPointFive( (oneKWidth+oneSpaceWidth)*index );
				}
			})
		},
		createK:function(){
			var thisGlobal=this.global,
				main=thisGlobal.main,
				xInLen=thisGlobal.xInLen,
				svgHeight=thisGlobal.svgHeight,
				xAxis=thisGlobal.settings.xAxis,
				fontSize=thisGlobal.fontSize,
				
				oneKWidth=MathCeil( thisGlobal.oneKWidth ),
				halfOneKWidth=thisGlobal.halfOneKWidth,
				oneSpaceWidth=thisGlobal.oneSpaceWidth,
				
				kx=thisGlobal.kx,
				ky=thisGlobal.ky,
				kTranslateY=thisGlobal.kTranslateY,	//30title + 20 ma-title
				kHeight=thisGlobal.kHeight,
				kColor={
					red: '#DD2200',		//#DD2200	#CC1C1C
					green: '#33AA11',	//#33AA11	#11D857
					list: [],	//用于成交量的柱状图显示
				},
				kG=createSE('g').attr('cursor','pointer'),
				
				kCoord={
					x: [],
					topY: [],
					lowY: []
				};
			
			function createK( curData, i, maxY, minY, height, color, v ){		//开盘或者收盘的数据
				var coord=kx(i)-.5,
					g=kG.appendSE('g',{
						transform: 'translate('+coord+',0)',
						fill: color
					});
				
				var maxY=MathFloor( maxY );
				var minY=MathFloor( minY );
				g.appendSE('rect',{		//上下影线
					x: halfOneKWidth,
					y: maxY,
					width: 1,
					height: height
				});
				g.appendSE('rect',{		//阴、阳线实体
					x: 0,
					y: MathFloor( kTranslateY + ky( curData ) ),
					width: oneKWidth,
					height: MathAbs( ky(v[0])-ky(v[3]) ) || 1
				});
				g.appendSE('rect',{		//透明层，用户移入K线图显示手型的用户体验的改善
					x: 0,
					y: maxY,
					width: oneKWidth,
					height: height,
					fill: 'transparent'
				});
				
				kCoord.x.push( coord );
				kCoord.topY.push( maxY );
				kCoord.lowY.push( minY );
				return g;
			}
			
			thisGlobal.k.forEach(function(v,i){
				var maxY=kTranslateY + ky( v[1] ),	//最高价在svg中站的位置
					minY=kTranslateY + ky( v[2] ),	//最低价在svg中站的位置
					height=MathAbs(maxY-minY),
					
					calc=v[0]-v[3],	//开 - 收
					color,
					kSmallG;
				
				if( calc>0 ){
					color=kColor.green;
					kSmallG=createK( v[0], i, maxY, minY, height, color, v );	//开盘在阴线上面
					
				}else if( calc<0 ){
					color=kColor.red;
					kSmallG=createK( v[3], i, maxY, minY, height, color, v );	//收盘在阳先上面
					
				}else{
					if(v[5].charAt(0)=='+'){	//当开=收时，根据涨跌幅计算红（+）绿（-）
						color=kColor.red
						
					}else{
						color=kColor.green
					}
					
					kSmallG=createK( v[0], i, maxY, minY, height, color, v );	//开盘=收盘，无所谓哪个用来计算阴阳线的y值
				}
				kColor.list.push( color );
			});
			
			main.append(kG);
			return thisGlobal.add({
				kCoord: kCoord,
				kColor: kColor,
				halfOneKWidth: halfOneKWidth,
				kG: kG
			})
		},
		ma:function(){
			var _this=this,
				thisGlobal=_this.global,
				kTranslateY=thisGlobal.kTranslateY,
				ky=thisGlobal.ky,
				kXCoord=thisGlobal.kCoord.x,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				maColor=thisGlobal.maColor,
				series=thisGlobal.settings.series,
				allMa=[series.ma5, series.ma10, series.ma20, series.ma30],
				maG=thisGlobal.main.appendSE('g').attr('fill','none');
			
			for(var i=0, len=allMa.length, dArr=[], path, allMaPath=[]; i<len; i++){		//画N条均线
				dArr.length=0;
				allMa[i].forEach(function(v,i){	//算出当前均线的d属性
					var y=ky(v)+kTranslateY;
					dArr.push( i ? 'L'+( kXCoord[i]+halfOneKWidth )+' '+y : 'M'+halfOneKWidth+' '+y)
				});
				path=maG.appendSE('path',{
					class: 'capi-kline',
					d: dArr.join(''),
					stroke: maColor[i]
				});
				
				allMaPath.push(path);
			}
			
			return thisGlobal.add({
				allMa: allMa,
				allMaPath: allMaPath
			});
		},
		maClick:function(){
			var _this=this,
				thisGlobal=_this.global,
				maTitle=thisGlobal.maTitle,
				allMaTspan=thisGlobal.allMaTspan,
				allMaPath=thisGlobal.allMaPath,
				
				maColor=thisGlobal.maColor,
				gray='#ccc',
				
				show={
					0: 0,	//ma5是否显示，0不显示
					1: 0,	//ma10
					2: 0,	//ma20
					3: 0	//ma30
				};
			
			function toGray(i,j){	//让均线变灰
				allMaTspan[i].attr('fill',gray);
				allMaTspan[j].attr('fill',gray);
			}
			
			function toLight(i,j,color){	//让均线变回原来的颜色
				allMaTspan[i].attr('fill',color);
				allMaTspan[j].attr('fill',color);
			}
			
			function is(count, i , j){	//判断均线及是否显示
				show[count] ? toLight(i,j,maColor[count]) : toGray(i,j);
				return count
			}
			
			maTitle.on('click','tspan',throttle(function(){
				var count,
					on;
				
				switch($(this).index()){
					case 0:
					case 1:
						count=is(0, 0, 1);	//ma5
						break;
					case 2:
					case 3:
						count=is(1, 2, 3);	//ma10
						break;
					case 4:
					case 5:
						count=is(2, 4, 5);	//ma20
						break;
					case 6:
					case 7:
						count=is(3, 6, 7);	//ma30
						break;
				}
				on=show[count];
				allMaPath[count].attr('visibility', on ? 'visible' : 'hidden');
				show[count]=!on;
				
			},0,200));
			
			return _this
		},
		trade:function(){	//内部交易、大宗交易
			var _this=this,
				thisGlobal=_this.global,
				main=thisGlobal.main,
				
				kCoord=thisGlobal.kCoord,
				kXCoord=kCoord.x,
				kLowYCoord=kCoord.lowY,
				
				kColor=thisGlobal.kColor,
				red=kColor.red,
				green=kColor.green,
				
				tradeG=main.appendSE('g',{
					class: 'capi-flag',
					cursor:'pointer'
				}),
				
				tradeScale=thisGlobal.tradeScale,
				dTriangle='M5 0 10 6 0 6',		//设置内部交易的三角形，以宽度为10，高度为6作为基础，通过K线的宽度进行定比例缩放
				dLhbang='M5 0 10 5 5 10 0 5zM5 1 1 5 5 9 9 5zM5 3 7 5 5 7 3 5z';	//龙虎榜菱形
				//dLhbang='M5 0 10 5 5 10 0 5zM5 .5 .5 5 5 9.5 9.5 5zM5 2 8 5 5 8 2 5z';
			
			function createFlag(type,index,color,tradeNum,data,titText,hasBigAndLhb){
				var y=kLowYCoord[index]+tradeNum*6*tradeScale+tradeNum*5+5;
				
				if(hasBigAndLhb){
					y=MathFloor(y+3*tradeScale-1);	//当既存在龙虎榜数据，又存在大宗交易数据时，圆形多高了3=10-6-1
				}
				
				var attr={
						transform: 'translate('+kXCoord[index]+','+y+') scale('+tradeScale+')'
					},
					eType;
				
				if(type){
					eType='circle';
					attr=$.extend(attr, {	//设置内部交易的三角形，以宽度为10，高度为6作为基础，通过K线的宽度进行定比例缩放
						cx: 5,
						cy: 5,
						r: 3,
						fill: '#fff',
						stroke: '#DD2200',
						'stroke-width': 2,
						id: 'tj-bigTrade'
					});
				}else{
					eType='path';
					attr.fill=color;
					if(type===0){
						attr.d=dTriangle;
						attr.id = 'tj-insidertrade';
					}else{
						attr.d=dLhbang;
						attr.stroke='rgba(0,0,0,0)';
						attr.id = 'tj-lhb';
					}
				}
				
				tradeG.appendSE( eType, attr).data('data', data).appendSE('title').text( titText );
					  
				return ++tradeNum
			}
			
			var xAxis=thisGlobal.settings.xAxis;
			thisGlobal.settings.series.trade.forEach(function(v){
				var tradeNum=0,	//一个K线下有多少个交易数据
					index=v.index,
					time=v.time,
					buy=v.buy,
					sell=v.sell,
					big=v.big,
					lhbang=v.lhbang;
				
				var hasBigAndLhb=0;
				
				if(buy){
					tradeNum=createFlag(0, index, red, tradeNum, {
						time: time,
						buy: buy
					}, '【内部交易数据】'+buy[0]+addEllipsis(buy[1]) )
					/**
					 * 	{time: v.time, buy； v.buy}
					 * 	自身的数据存储，后面点击事件时用到
					 */
				}
				if(sell){
					tradeNum=createFlag(0, index, green, tradeNum, {
						time: time,
						sell: sell
					}, '【内部交易数据】'+sell[0]+addEllipsis(sell[1]) );
				}
				if(big){
					tradeNum=createFlag(1, index, red, tradeNum, {
						time: time,
						big: big,
						buyerUrl: v.buyerUrl,
						vendorUrl: v.vendorUrl
					}, '【大宗交易数据】成交价格：'+big[0].price+' 成交量：'+big[0].vol+' 成交金额：'+big[0].sum+addEllipsis(big[1]) );
					hasBigAndLhb=1;
				}
				if(lhbang){
					createFlag(false, index, red, tradeNum, {
						requireTime: xAxis[index],		//ajax请求地址时用
						time: time,						//显示龙虎榜数据时用
						title: lhbang,
						lhb: 1							//判断是否是龙虎榜时用
					}, '【龙虎榜数据】'+time+' '+lhbang, hasBigAndLhb)
				}
			});
			return thisGlobal.add({
				tradeG: tradeG
			})
		},
		notice:function(){
			var _this=this,
				thisGlobal=_this.global,
				notice=thisGlobal.settings.series.notice;
			if(!notice[0]) return _this;
			
			var	noticeG=thisGlobal.main.appendSE('g',{
					class: 'capi-flag',
					transform: 'translate(0, 50)',
					fill: thisGlobal.kColor.red,
					cursor: 'pointer'
				}),
				d='M5 0 10 5 5 10 0 5',
				
				kXCoord=thisGlobal.kCoord.x,
				tradeScale=thisGlobal.tradeScale;
				
			notice.forEach(function(v){
				var rhombus=noticeG.appendSE('path',{	//公告的菱形，宽高基数都为10
						id: 'notice-'+v.index,
						d: d,
						transform: 'translate('+kXCoord[v.index]+',0) scale('+tradeScale+')'
					}),
					tit=v.text[0].title;
				rhombus.appendSE('title').text( '【公司公告】'+tit+addEllipsis(v.text[1]) );
			});
			
			return thisGlobal.add({
				noticeG: noticeG,
				notice: notice
			})
		},
		bar:function(){
			var _this=this,
				thisGlobal=_this.global,
				k=thisGlobal.k,
				kXCoord=thisGlobal.kCoord.x,
				kColorList=thisGlobal.kColor.list,
				oneKWidth=MathCeil( thisGlobal.oneKWidth ),
				barHeight=thisGlobal.barHeight,
				volG=thisGlobal.main.appendSE('g',{
					transform: 'translate(0,'+thisGlobal.barTranslateY+')'
				}),
				
				volBarHeight=barHeight*.9,
				volSpaceHeight=barHeight*.1,
				aVol=[],
				volHCalc,
				maxMinVol;
			
			volG.appendSE('path',{	//分界线
				d: 'M0 .5 '+thisGlobal.svgWidth+' .5',
				stroke: '#ccc'
			});
			
			k.forEach(function(v){	//提取最大最小值
				aVol.push( v[4] )
			});
			maxMinVol=arrMaximin(aVol);
			
			volHCalc=function(){
				var scale=volBarHeight/maxMinVol.max;
				return function(curNum){
					return MathFloor( curNum*scale )
				}
			}();
			
			k.forEach(function(v,i){	//创建成交量柱状图
				var height=volHCalc( v[4] );
				volG.appendSE('rect',{
					x: kXCoord[i],
					y: MathFloor( volBarHeight - height + volSpaceHeight ),
					width: oneKWidth,
					height: height,
					fill: kColorList[i]
				})
			});
			return thisGlobal.add({
				volG: volG,
				maxVol: maxMinVol.max,
				minVol: maxMinVol.min,
				volHCalc: volHCalc,
				volBarHeight: volBarHeight,
				volSpaceHeight: volSpaceHeight
			});
		},
		createKChartIndex:function(indexType){
			var _this=this,
				thisGlobal=_this.global,
				arr=['Market','Macd','Kdj','Rsi'];
			
			switch(+indexType){
				case 1:
					method=arr[1];
					break;
				case 2:
					method=arr[2];
					break;
				case 3:
					method=arr[3];
					break;
				default:
					method=arr[0];
			}
			
			_this[method.toLowerCase()]();			//创建图表底部
			arr.forEach(function(v){				//清空图表底部所有的hover事件
				thisGlobal['has'+v]=0;
			});
			thisGlobal['has'+method]=1;				//添加图表底部的hover事件
		},
		chartBottom:function(){
			if(this.global.settings.indexType==UNDEFINED) return;	//四大指数兼容
			var thisGlobal=this.global,
				chartBottomHeight=thisGlobal.chartBottomHeight,
				chartBottomG=thisGlobal.main.appendSE('g',{
					transform: 'translate(0,'+addPointFive( thisGlobal.svgHeight - chartBottomHeight - 20 )+')'
				});
			
			chartBottomG.appendSE('path',{		//上边界线
				d: 'M0 0 '+thisGlobal.svgWidth+' 0',
				stroke: '#ccc'
			});
			
			thisGlobal.add({
				chartBottomG: chartBottomG
				
			}).createKChartIndex(thisGlobal.settings.indexType);
		},
		market:function(){
			var thisGlobal=this.global,
				marketHeight=thisGlobal.chartBottomHeight,
				kXCoord=thisGlobal.kCoord.x,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				
				market=WIN.syncChartsData.k.series.market,
				data=market.data,
				event=market.event,
				strokeColor='#173070';		//分时图蓝色'rgba(0, 52, 116, 1)'
				
			var marketG=thisGlobal.chartBottomG.appendSE('g'),	//用于切换删除
				circleG=marketG.appendSE('g',{
					fill: '#fff',
					stroke: strokeColor
				}),
				
				lastIndex=thisGlobal.xInLen;
				marketTitle=createTitle(					//文本
					6,
					marketG,
					[
						'市场关注度',								//标题
						thisGlobal.settings.xAxis[lastIndex],	//日期
						data[lastIndex]
					]
				);
			
			var maxMin=arrMaximin( data );
			var max=maxMin.max;
			var calcY=function(){
				var scale=(marketHeight-30)/(max-maxMin.min);		//-30: 上20（文字）, 下间距10
				return function(cur){
					return MathFloor( (max-cur)*scale )
				}
			}();
			
			var d='';
			var marketYCoord=[];
			var aCircleElem=[];
			
			data.forEach(function(v,i){
				var x=kXCoord[i]+halfOneKWidth;
				var y=calcY(v)+24;	//上面距离24，下面距离6
				d+= (d ? ' ' : 'M')+x+' '+y;
				
				var elem=circleG.appendSE('circle',{
					cx: x,
					cy: y,
					r: 2
				});
				elem.appendSE('title').text( '市场关注度：'+v );
				
				aCircleElem.push( elem );
				marketYCoord.push( y );
			});
			
			marketG.appendSE('path',{		//市场关注度折线
				d: d,
				fill: 'none',
				stroke: strokeColor,
				'stroke-width': 2
				
			}).after(circleG);
			
			if(event.length){
				var redCircleG=marketG.appendSE('g',{
						class: 'capi-market-red',
						fill: '#DD2200',
						cursor: 'pointer'
					}),
					r=thisGlobal.svgWidth/766*4.6;	//小响应式设置圆点大小
					
				r>6.5 && (r=6.5);
				r<3.5 && (r=3.5);
				
				event.forEach(function(v){
					aCircleElem[v.index].attr('r', r).appendTo( redCircleG );
				});
			}
			
			thisGlobal.add({
				marketTitle: marketTitle	//供hover用
				
			}).marketClick(redCircleG, marketYCoord);
		},
		dynamic:function(){
			var _this=this,
				thisGlobal=_this.global;
			
			if(thisGlobal.settings.dynamic){	//当是最后一个K线并处在实时更新的时段，给它加上这个动画效果，以示动态更新
				$('g:last', thisGlobal.kG).attr('class','capi-dynamic');
				thisGlobal.volG && $('rect:last', thisGlobal.volG).attr('class','capi-dynamic');
			}
			return _this;
		},
		hover:function(){
			var thisGlobal=this.global,
				xAxis=thisGlobal.settings.xAxis,
				syncSeries=WIN.syncChartsData.k.series,		//使用动态更新K数据
				allMa=thisGlobal.allMa,
				kTspan=$('tspan',thisGlobal.title),
				allMaTspan=thisGlobal.allMaTspan,
				
				offset=thisGlobal.offset,
				kXCoord=thisGlobal.kCoord.x,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				oneSum=thisGlobal.oneKWidth+thisGlobal.oneSpaceWidth,
				
				main=thisGlobal.main,
				volG=thisGlobal.volG,
				bgline=thisGlobal.bgline,
				rectHeight=thisGlobal.svgHeight-50,
				
				hoverRect=main.appendSE('rect',{	//背景层，用于事件移入的监听
					x: 0,
					y: 30,
					width: thisGlobal.svgWidth,
					height: rectHeight,
					fill: 'transparent'
				}),
				line;
			
			/**
			 * bgline的一系列after操作是为了让线段和背景层能合理的处在DOM结构中，以便hover时的良好视觉效果
			 */
			bgline.after(hoverRect);
			if(volG){
				bgline.after(volG)
			}
			
			hoverRect.mousemove(throttle(function(arg){
				!line && (line=main.appendSE('path',{
					d: 'M0 0 0 '+rectHeight,
					stroke: '#666',
					'stroke-dasharray': 0
				}), bgline.after(line));
				
				var index=MathFloor( (arg[0].pageX-offset.left)/oneSum ),
					kx=kXCoord[index];
				/*
				if(oldIndex){	//减少Dom操作，如果移入的线段在同一个位置，阻止往下执行
					if(oldIndex==index) return
				}
				oldIndex=index;
				*/
				
				if(kx!=UNDEFINED){
					line.attr({
						visibility: 'visible',
						transform: 'translate('+( kx+halfOneKWidth+.5 )+',30)'
					});
					
					var kData=syncSeries.data;
					kTspan.eq(1).text( xAxis[index] );	//日期
					kTspan.eq(3).text( kData[index][0] );	//开
					kTspan.eq(5).text( kData[index][1] );	//高
					kTspan.eq(7).text( kData[index][2] );	//低
					kTspan.eq(9).text( kData[index][3] );	//收
					kTspan.eq(11).text( formatVol(kData[index][4]) );	//量
					kTspan.eq(13).text( kData[index][5] );	//幅
					
					/*
					allMaTspan[1].text( allMa[0][index] );		//ma5
					allMaTspan[3].text( allMa[1][index] );		//ma10
					allMaTspan[5].text( allMa[2][index] );		//ma20
					allMaTspan[7].text( allMa[3][index] );		//ma30
					*/
					for(var i=0, j=1; i<4; i++, j+=2){				//循环修改均线标题文本值
						allMaTspan[j].text( allMa[i][index] );
					}
					
					if(thisGlobal.hasMarket){
						var marketTitleTspan=thisGlobal.marketTitle.find('tspan'),
							marketData=syncSeries.market.data;
						
						marketTitleTspan.eq(1).text( xAxis[index] );
						marketTitleTspan.eq(2).text( marketData[index] );
						
					}else if(thisGlobal.hasMacd){
						var macd=syncSeries.macd;
						chartBottomTitSet(thisGlobal.macdAllTspan, macd.dif[index], macd.dea[index], macd.bar[index]);
						
					}else if(thisGlobal.hasKdj){
						var kdj=syncSeries.kdj;
						chartBottomTitSet(thisGlobal.kdjAllTspan, kdj.k[index], kdj.d[index], kdj.j[index]);
						
					}else if(thisGlobal.hasRsi){
						var rsi=syncSeries.rsi;
						chartBottomTitSet(thisGlobal.rsiAllTspan, rsi.rsi6[index], rsi.rsi12[index], rsi.rsi24[index]);
					}
					
					function chartBottomTitSet(tSpan, f, s, t){
						tSpan[1].text( f );
						tSpan[3].text( s );
						tSpan[5].text( t );
					}
				}
				
			},0,32)).mouseout(function(){
				line && line.attr('visibility','hidden');
			});
			
			main.on('mouseover','.capi-kline',function(){
				$(this).attr('stroke-width', 3);
				
			}).on('mouseout','.capi-kline',function(){
				$(this).attr('stroke-width', 1);
				
			});
		},
		icon:function(){
			var thisGlobal=this.global,
				offset=thisGlobal.offset,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				kCoord=thisGlobal.kCoord,
				kx=kCoord.x,
				kTopY=kCoord.topY,
				
				dragLineG=thisGlobal.dragLineG,
				icon=thisGlobal.settings.series.icon,
				allIconHtml=[];
				
			icon.forEach(function(v,j){	//v：每一个icon的名字，例如[a1,a2], j当前数据在数组的索引，用于后面找index
				v.name.forEach(function(v,i){	//v：当前icon的文本值，i：当前的索引，用以计算path线段的d属性的高
					var index=icon[j].index,
						translateX=kx[index]+halfOneKWidth+.5,
						translateY=kTopY[index],
						lineHeight=10+i*18,
						str;
					
					dragLineG.appendSE('path',{
						id: 'capi-ev-'+v,
						//规定每个path线段的高度为10，以后的为10+i*18（icon的高度-2底部边框）
						d: 'M0 0 0 -'+lineHeight,
						transform: 'translate('+translateX+','+translateY+')'
					});
					
					str=createEvIcon({
						boxOffsetLeft: offset.left,
						boxOffsetTop: offset.top,
						iconHtml: v,	//icon的文本内容，用于显示
						title: icon[j].title[i],	//事件压缩内容的标题
						nid: icon[j].nid[i],	//用于后端
						iconInSvgleft: translateX-10,	//icon在svg中左边距离，用于定位icon在html中的left，以下同理
						iconInSvgTop: translateY-lineHeight-19 	//icon距离顶部的距离-线的高度-icon的高度
					});
					allIconHtml.push(str);
				});
			});
			$BODY.append( allIconHtml.join('') );
		},
		tradeClick: function(){
			var _this=this,
				thisGlobal=_this.global,
				dragLineG=thisGlobal.dragLineG,
				offset=thisGlobal.offset,
				$winSet=thisGlobal.$winSet,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				tradeScale=thisGlobal.tradeScale;
			
			function runCreateTradeShow(_this, tagName){
				if( _this.data('show') ) return;	//阻止每次点击都创建展示信息
				
				var	type= tagName=='circle' ? 1 : 0,	// 1： 大宗交易， 0： 内部交易，用于createTradeShow展示内容时判断
					transform=_this.attr('transform'),
					//ie: translate(994 328.4) scale(1.7), ff/chrome: translate(994,328.4) scale(1.70)
					
					x=+transform.replace(/.+\((.+)[,| ]\d.+/,'$1')+halfOneKWidth+.5,	//994
					y=+transform.replace(/.+[,| ](\d.+)\).+/,'$1')+(type ? 5 : 3)*tradeScale,	//328.4, (type ? 10 : 6)*scale/2
					dragLine;
				
				if(_this.data('data').lhb){	//龙虎榜：type应为1，而判断给了0，导致y计算少了
					y+=2*tradeScale
				}
				
				dragLine=dragLineG.appendSE('path',{
					d: 'M0 0 0 0',
					transform: 'translate('+x+','+y+')'
				});
				
				createTradeShow( _this, type, dragLine, {
					$WinWidth: $winSet.width,
					$WinHeight: $winSet.height,
					boxOffsetLeft: offset.left,
					boxOffsetTop: offset.top,
					translateX: x,
					translateY: y,
					lhb: _this.data('data').lhb ? 1 : 0
					
				}, _this.data('data').lhb && 'lhb');
				_this.data('show', 1);
			}
			
			thisGlobal.tradeG.on('click', function(e){
				var target=e.target;
				runCreateTradeShow( $(target), target.tagName )
			});
			return _this;
		},
		kClick: function(){
			var thisGlobal=this.global,
				dragLineG=thisGlobal.dragLineG,
				kG=thisGlobal.kG,
				stock=thisGlobal.settings.stock,
				xAxis=thisGlobal.settings.xAxis,
				
				offset=thisGlobal.offset,
				$winSet=thisGlobal.$winSet,
				kCoord=thisGlobal.kCoord,
				kXCoord=kCoord.x,
				kTopYCoord=kCoord.topY,
				halfOneKWidth=thisGlobal.halfOneKWidth;
			
			kG.on('click','g',function(){
				var _this=$(this);
				if( _this.data('show') ) return;	//阻止每次点击都创建展示信息
				
				var	i=_this.index(),
					x=kXCoord[i]+halfOneKWidth+.5,
					y=kTopYCoord[i],
					dragLine;
				
				dragLine=dragLineG.appendSE('path',{
					d: 'M0 0 0 0',
					transform: 'translate('+x+','+y+')'
				});
					
				createTimeShow( _this, dragLine, {
					$WinWidth: $winSet.width,
					$WinHeight: $winSet.height,
					boxOffsetLeft: offset.left,
					boxOffsetTop: offset.top,
					translateX: x,
					translateY: y,
					stock: stock,
					time: xAxis[i]
				});
				_this.data('show', 1);
			});
			
			return this;
		},
		noticeClick:function(){
			var thisGlobal=this.global,
				noticeG=thisGlobal.noticeG;
			if(!noticeG) return;
			
			var	dragLineG=thisGlobal.dragLineG,
				offset=thisGlobal.offset,
				$winSet=thisGlobal.$winSet,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				translateY=halfOneKWidth+50,
				
				kXCoord=thisGlobal.kCoord.x,
				notice=thisGlobal.notice;
			
			noticeG.on('click.charts','path',function(){
				var _this=$(this);
				if( _this.data('show') ) return;
				
				var	index=_this.index(),
					curNotice=notice[index],
					translateX=kXCoord[ curNotice.index ]+halfOneKWidth,
					
					dragLine=dragLineG.appendSE('path',{
						d: 'M0 0 0 0',
						transform: 'translate('+translateX+','+translateY+')'
					}),
					con=[];
				
				curNotice.text.forEach(function(v){
					con.push('<div class="content">'+
								'<header>'+v.title+'</header>'+
								'<p class="gray-text">'+v.date+'</p>'+
								'<p>'+v.content+'</p>'+
							 '</div>')
				});
				createShow(
					'<header class="capi-title">公司公告</header>',
					con.join(''),
					_this,
					dragLine,
					{
						$WinWidth: $winSet.width,
						$WinHeight: $winSet.height,
						boxOffsetLeft: offset.left,
						boxOffsetTop: offset.top,
						translateX: translateX,
						translateY: translateY
					},
					3
				);
				_this.data('show', 1);
			})
		},
		marketClick:function(redCircleG, marketYCoord){
			if(!redCircleG){
				return
			}
			var thisGlobal=this.global,
				dragLineG=thisGlobal.dragLineG,
				offset=thisGlobal.offset,
				$winSet=thisGlobal.$winSet,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				
				marketGTanslateY=addPointFive( thisGlobal.svgHeight - thisGlobal.chartBottomHeight - 20 ),
				kXCoord=thisGlobal.kCoord.x,
				market=WIN.syncChartsData.k.series.market;
			
			redCircleG.on('click.charts','circle',function(){
				var _this=$(this);
				if( _this.data('show') ) return;
				
				var	i=_this.index(),
					curEvent=market.event[i],
					index=curEvent.index,
					translateX=kXCoord[ index ]+halfOneKWidth,
					translateY=marketGTanslateY + marketYCoord[index],
					
					dragLine=dragLineG.appendSE('path',{
						d: 'M0 0 0 0',
						transform: 'translate('+translateX+','+translateY+')'
					}),
					con=[];
				
				if( !curEvent.text ){
					$.ajax({
						url: siteUrl+'stock/heatnews/'+stkCode+'/'+curEvent.id.join('|'),
						dataType: 'json'
					}).done(function(msg){
						curEvent.infl=[];
						curEvent.text=[];
						msg.forEach(function(v){
							curEvent.infl.push( v.heat )
							curEvent.text.push( v.title )
						})
						createRun()
						_this.data('hasMarketData', 1)
					})
				}else{
					createRun()
				}
				
				function createRun(){
					curEvent.text.forEach(function(v,i){
						con.push( '<p><a href="'+siteUrl+'news/view/'+curEvent.id[i]+'/'+stkCode+'" target="_blank">'+v+'</a>&nbsp;&nbsp;&nbsp;&nbsp;影响力：'+curEvent.infl[i]+'</p>' )
					});
					createShow(
						'<header class="capi-title">'+curEvent.time+'</header>',
						'<div class="content">'+'<p class="bold">当天市场关注度指数：'+market.data[index]+'</p><p>当天重要新闻：</p>'+con.join('')+'</div>',
						_this,
						dragLine,
						{
							$WinWidth: $winSet.width,
							$WinHeight: $winSet.height,
							boxOffsetLeft: offset.left,
							boxOffsetTop: offset.top,
							translateX: translateX,
							translateY: translateY,
							isMarket: 1
						},
						0
					);
					_this.data('show', 1);
				}
				
			})
		},
		update:function(data){	//可优化，这里每次都会请求this.global等值的获取
			var thisGlobal=this.global,
				
				xInLen=thisGlobal.xInLen,
				max=thisGlobal.max,
				min=thisGlobal.min,
				maxVol=thisGlobal.maxVol,
				minVol=thisGlobal.minVol,
				kColor=thisGlobal.kColor,
				ky=thisGlobal.ky,
				kTranslateY=thisGlobal.kTranslateY,
				kHeight=thisGlobal.kHeight,
				
				lastK=$('.capi-dynamic',thisGlobal.kG),
				lastAllRect=$('rect',lastK),
			
				high=data.high,
				low=data.low,
				close=data.close,
				open=data.open,
				vol=data.vol,
				time=data.time,
				
				hasTrueVol=1,	//用于判断是否存在成交量，并且更新的成交量小于最大成交量
				
				syncK=WIN.syncChartsData.k;
				
			syncK.series.data[xInLen]=[open, high, low, close, data.vol, data.zdf+'%'];	//同步数据
			
			/**
			 * 	当现在K线最大值小于最大值，现在最小值大于最小值时，当有成交量并且成交量小于最大值，直接修改最后一个K线，和最后一个成交量，
			 * 	否则重绘K线图
			 */
			if(maxVol && vol>maxVol ){		//当有成交量并且成交量大于最大值时，重绘
				hasTrueVol=0
			}
			if(high<=max && low>=min && hasTrueVol ){
				//console.log('in')
				var maxY=kTranslateY + ky( high ),	//最高价在svg中站的位置
					minY=kTranslateY + ky( low ),	//最低价在svg中站的位置
					height=MathAbs(maxY-minY),
					
					calc=open-close,	//开 - 收
					secRectTopY=open,	//第二个矩形的顶端Y值计算用开盘价，然后在if里判断是否修改
					color=kColor.green;
				
				if( calc<0 ){
					color=kColor.red;
					secRectTopY=close;
					
				}else if(calc==0){
					data.zdf.charAt(0)=='+' && (color=kColor.red);
				}
				
				lastAllRect.eq(0).attr({
					y: maxY,
					height: height
				});
				lastAllRect.eq(1).attr({
					y: kTranslateY + ky(secRectTopY),
					height: MathAbs( ky(open)-ky(close) ) || 1
				});
				lastAllRect.eq(2).attr({
					y: maxY,
					height: height
				});
				lastK.attr('fill')!=color && lastK.attr('fill',color);
				
				if(maxVol){	//成交量更新
					var lastVolRect=$('rect.last',thisGlobal.volG),
						volBarHeight=thisGlobal.volBarHeight,
						volSpaceHeight=thisGlobal.volSpaceHeight,
						
						volHeight=thisGlobal.volHCalc(data.vol);
						
					lastVolRect.attr({
						y: MathFloor( volBarHeight- volHeight + volSpaceHeight ),
						height: volHeight,
						fill: color
					});
				}
			}else{
				//console.log( 'out' )
				WIN.redraw.k( thisGlobal.box, syncK, thisGlobal.settings.hasBar )
			}
			/*
				data={
					close: "15.2",	//当前收盘价
					closed: "67.25",	//前一天的收盘价
					code: "600000",
					date: "2015-07-12",
					high: "17.6",
					low: "16.77",
					name: '浦发银行',
					open: '17.00',
					time: '11:38',
					timeVol: 1306600,
					vol: 104985441,
					zde: '-0.25',
					zdf: '-1.47'
				}
			*/
		},
		modal_bottomTit:function(parent, color, text){
			/**
			 * parent： 元素对象，标题内容的父级
			 * color: ['#E96D6D','#36A3DC','#C9A811','#1966AE']
			 * text=[
						'MA5：', '25.21',
						'MA10：', '21.1',
						'MA20：', '51.34',
						'MA30：', '65.02'
					]
			 */
			var textElem=parent.appendSE('text',{
					y: 16
				}),
				allTspan=[],
				len=text.length,
				tspan;
			
			for(var i=0; i<len; i++){
				tspan=textElem.appendSE('tspan',{
					cursor: 'pointer',
					fill: color[ MathFloor(i/2) ]
					
				}).text( text[i] );
				
				i%2 || tspan.attr('dx',10);
				allTspan.push(tspan);
			}
			
			return {
				allTspan: allTspan,
				textElem: textElem
			}
		},
		changeBottom:function(indexType){
			var _this=this;
			
			$('.capi-market').trigger('dblclick.charts');				//删除，如果有市场关注度的弹窗
			_this.global.chartBottomG.find('>g').remove();				//清空底部
			_this.createKChartIndex( indexType );						//create
		},
		macd:function(){
			var _this=this,
				thisGlobal=_this.global,
				xInlen=thisGlobal.xInLen,
				macd_G=thisGlobal.chartBottomG.appendSE('g'),
				macdData=WIN.syncChartsData.k.series.macd,
				dif=macdData.dif,
				dea=macdData.dea,
				bar=macdData.bar,
				
				color=['#2ACBEE','#CC22BA','#C00'],
				text=[
						'DIF：', dif[xInlen],
						'DEA：', dea[xInlen],
						'MACD：', bar[xInlen]
				],
				
				o=_this.modal_bottomTit(
					macd_G,
					color,
					text
				);
			
			thisGlobal.add({
				macdAllTspan: o.allTspan
			});
			//------------ 标题创建结束 -----------------
			
			var macdHeight=thisGlobal.chartBottomHeight-20,	//标题高
				kXCoord=thisGlobal.kCoord.x,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				
				maxMin=arrMaximin( [dif, dea, bar] ),
				max=MathMax( maxMin.max, MathAbs(maxMin.min) ),
				
				scale=macdHeight/(2*max);
				calcY=function(cur){
					return MathFloor( (max-cur)*scale )
				};
			
			var macdSet=[],
				halfMacdHeight=macdHeight/2,
				macdInG=macd_G.appendSE('g',{
					transform: 'translate(0,'+MathFloor( halfMacdHeight+20 )+')'
				}),
				oneKWidth=MathCeil( thisGlobal.oneKWidth );
			
			[dif, dea].forEach(function(v,i){
				var d='M';
				v.forEach(function(v,i){
					var y=calcY(v)+20;
					d+=( kXCoord[i]+halfOneKWidth )+' '+y+' ';
				});
				var elem=macd_G.appendSE('path',{
					class: 'capi-kline',
					d: d,
					fill: 'none',
					stroke: color[i]
				});
				macdSet.push( elem );
			});
			
			var barCalcY=function(){
				var scale=macdHeight/(2*max);
				return function(cur){
					return MathFloor( (max-cur)*scale );
				}
			}();
			bar.forEach(function(v,i){
				var y=barCalcY( v );
				var isInt= v>0 ? 1 : 0;
				var dvaule=MathFloor( y-halfMacdHeight );
				
				macdInG.appendSE('rect',{
					width: oneKWidth,
					height: MathAbs( dvaule ),
					x: kXCoord[i],
					y: (isInt ? dvaule : 0) + .5,
					fill: isInt ? color[2] : '#2EC196'
				});
			});
			macdSet.push( macdInG );
			
			_this.macdTitClick(o.textElem, macdSet, color, o.allTspan);
		},
		macdTitClick:function(textElem, macdSet, color, allTspan){
			var gray='#ccc',
				light={
					0: 1,	//dif高亮有颜色
					1: 1,
					2: 1
				};
				
			function set(i, color, attr){
				var j=i*2;
				allTspan[j].attr('fill', color);
				allTspan[j+1].attr('fill', color);
				macdSet[i].attr('visibility', attr);
			}
			
			textElem.on('click.charts','tspan',throttle(function(){
				var i=0;
				
				switch($(this).index()){
					case 2:
					case 3:
						i=1;
						break;
					case 4:
					case 5:
						i=2;
						break;
				}
				
				var on=light[i];
				on ? set(i, gray, 'hidden') : set(i, color[i], 'visible');
				
				light[i]=!on;
			},0,200));
		},
		emptyBottom:function(){
			$('.capi-market').trigger('dblclick.charts');				//删除，如果有市场关注度的弹窗
			this.global.chartBottomG.find('>g').remove();				//清空底部
		},
		kdj:function(){
			this.createKdjRsi('kdj', ['#2B9DFC','#FFB828','#CC22BA'], ['k','d','j']);
		},
		rsi:function(){
			this.createKdjRsi('rsi', ['#9A2875','#E5CA4E','#0AC2EA'], ['rsi6','rsi12','rsi24']);
		},
		createKdjRsi:function(name, color, children){
			var _this=this,
				thisGlobal=_this.global,
				xInlen=thisGlobal.xInLen,
				wrap_G=thisGlobal.chartBottomG.appendSE('g'),
				data=WIN.syncChartsData.k.series[name],
				children0=data[children[0]],
				children1=data[children[1]],
				children2=data[children[2]],
				
				text=[
						children[0].toUpperCase()+'：', children0[xInlen],
						children[1].toUpperCase()+'：', children1[xInlen],
						children[2].toUpperCase()+'：', children2[xInlen]
				],
				
				o=_this.modal_bottomTit(
					wrap_G,
					color,
					text
				);
			
			thisGlobal[name+'AllTspan']=o.allTspan;		//对hover时改变标题提供接口
			//------------ 标题创建结束 -----------------
			
			var drawHeight=thisGlobal.chartBottomHeight-20,	//标题高
				kXCoord=thisGlobal.kCoord.x,
				halfOneKWidth=thisGlobal.halfOneKWidth,
				
				aChildrenData=[children0, children1, children2],
				maxMin=arrMaximin( aChildrenData ),
				max=maxMin.max,
				
				scale=drawHeight/(max - maxMin.min);
				calcY=function(cur){
					return MathFloor( (max-cur)*scale )
				},
				
				shapeElemSet=[];
			
			aChildrenData.forEach(function(v,i){
				var d='M';
				v.forEach(function(v,i){
					var x=kXCoord[i];
					if(x!=UNDEFINED){		//去掉后端可能会多传的数据
						var y=calcY(v)+20;
						d+=( x+halfOneKWidth )+' '+y+' ';
					}
				});
				var elem=wrap_G.appendSE('path',{
					class: 'capi-kline',
					d: d,
					fill: 'none',
					stroke: color[i]
				});
				shapeElemSet.push( elem );
			});
			
			_this.macdTitClick(o.textElem, shapeElemSet, color, o.allTspan);
		}
	};
	/******************************** Kchart END **************************************/
	
	function Timechart(box,Options){
		return this.settings(box,Options),this
	}
	
	Timechart.prototype={
		settings:function(box,Options){		//配置
			var _this=this,
				settings=$.extend(true,{
					style: {
						font: '12px "\\5FAE\\8F6F\\96C5\\9ED1"',
						overflow: 'hidden',
						'box-sizing': 'border-box',
					},
					title:'分时图',
					delist: 0,	//默认不停牌，1：表示停牌
					dynamic: 0,
					hasBar: 0,
					xAxis: [],
					series: {}
				},Options),
				svg=box.appendSE('svg',{
					width:'100%',
					height:'100%',
					xmlns:SVG.ns
					
				}).css(settings.style),
				svgWidth=svg.width(),
				svgHeight=svg.height(),
				gradientHeight=svgHeight-50,	//渐变高度，20（xAxis）+ 30（title）
				fontSize=pInt( svg.css('font-size') ),
			
				main,
				xLength,
				lastIndex,
				series,
				time,
				color;
			
			if(!settings.series.data.length || svgWidth<10 || svgHeight<80 ) return svg.remove();	//当没有数据时，当盒子宽高不够以无法显示图形时，不绘图
			if( settings.delist ){		//停牌
				return svg.appendSE('text',{
					x: svgWidth/2,
					y: svgHeight/2+svgWidth/28,
					fill: '#ccc',
					'text-anchor': 'middle',
					'font-size': svgWidth/10
				}).text('停牌');
			}
			/******************* 以上基本参数配置 *****************************/
			
			main=createSE('g');	//创建整体
			
			xLength=settings.xAxis.length;	//x轴数据长度
			lastIndex=xLength-1;			//x轴最后一个数据在数组里的索引
			series=settings.series;
			time=series.data;
			color={
				gray: '#ccc',	//背景线 - 灰色
				blue: '#3D6AA9',	//成交量及分时线段 - 浅蓝色 
				dragLine: '#333',	//拖拽线 - 深黑色
				zero: '#DD2200',	//零界线 - 红色
				dot: '#418fcf',		//圆点 - 蓝色
				gradient: ['rgba(61, 106, 169, 1)', 'rgba(61, 106, 169, 0)']	//top - 蓝色, bottom - 蓝色透明，统一格式兼容国产浏览器
			};
			
			_this.global={
				box: box,
				svg: svg,
				main: main,
				settings: settings,
				series: series,
				time: time,
				svgWidth: svgWidth,
				svgHeight: svgHeight,
				gradientHeight: gradientHeight,
				fontSize: fontSize,
				xLength: xLength,
				lastIndex: lastIndex,
				color: color
			};
			
			_this.init();
			svg.append( main );
		},
		init:function(){	//初始化各种变量值
			var _this=this,
				thisGlobal=this.global,
				settings=thisGlobal.settings,
				hasBar=settings.hasBar,
				
				box=thisGlobal.box,
				boxOffset=box.offset(),
				boxOffsetLeft=boxOffset.left,
				boxOffsetTop=boxOffset.top,
				
				svgHeight=thisGlobal.svgHeight,
				gradientHeight=thisGlobal.gradientHeight,
				lineHeight=gradientHeight,	//默认没有柱状图，高度相等
				
				oneSpaceWidth=thisGlobal.svgWidth/240,	//241个点分成240份
				
				barHeight,
				maxMin=[],
				max;
			
			if(hasBar){
				barHeight=gradientHeight*.2;
				gradientHeight*=.8;
				lineHeight=gradientHeight*.8;
			}
			
			thisGlobal.time.forEach(function(v){
				maxMin.push( v[2]-0 )
			});
			maxMin=arrMaximin( maxMin );	//取出涨跌幅里的最大最小值
			max=arrMax( [MathAbs(maxMin.max), MathAbs(maxMin.min)] );	//取得最大最小值的绝对值的最大值
				
			$.extend(this.global,{
				maxZdf: max,
				boxOffsetLeft: boxOffsetLeft,
				boxOffsetTop: boxOffsetTop,
				barHeight: barHeight,
				gradientHeight: gradientHeight,
				lineHeight: lineHeight,
				oneSpaceWidth: oneSpaceWidth,
				calcY:function(){
					var scale=lineHeight/(2*max);
					return function(cur){
						return MathFloor( (max-cur) * scale )
					}
				}()
			});
			_this.method();
		},
		method:function(){	//方法调用
			with(this){
				var sets=global.settings;
				bg();
				dragLine();
				title();
				timeShape();
				sets.dynamic && flashDot();
				sets.hasBar && bar();
				xAxis();
				zero();
				sets.series.icon[0] && icon();
				move();
			}
			
		},
		bg:function(){
			var thisGlobal=this.global,
				svgWidth=thisGlobal.svgWidth,
				bgG=thisGlobal.main.appendSE('g',{
					stroke: thisGlobal.color.gray,
					'stroke-dasharray': 6
				}),
				boundaryY=['29.5', thisGlobal.svgHeight-20.5];
			
			boundaryY.forEach(function(v){	//创建顶端，低端的两条分界横线
				bgG.appendSE('path',{
					d: 'M0 '+v+' '+svgWidth+' '+v,
					'stroke-dasharray': 0
				});
			});
			
			$.extend(thisGlobal,{
				bgG: bgG
			});
		},
		dragLine:function(){
			var thisGlobal=this.global,
				dragG=thisGlobal.main.appendSE('g',{
					stroke: thisGlobal.color.dragLine
				});
			$.extend(thisGlobal,{
				dragG: dragG
			});
		},
		title:function(){
			var thisGlobal=this.global,
				settings=thisGlobal.settings,
				lastIndex=thisGlobal.lastIndex,
				time=thisGlobal.time;
				
				title=createTitle(
					thisGlobal.fontSize,
					thisGlobal.main,
					[
						settings.title,			//标题
						settings.xAxis[lastIndex],	//日期
						'价：',
						time[lastIndex][0],
						'量：',
						formatVol( time[lastIndex][1] ),
						'幅：',
						time[lastIndex][2]+'%'
					]
				);
				
			$.extend(thisGlobal,{
				title: title
			});
		},
		timeShape:function(){
			var thisGlobal=this.global,
				gradientHeight=thisGlobal.gradientHeight,	//渐变背景的高度
				oneSpaceWidth=thisGlobal.oneSpaceWidth,
				
				timeG=thisGlobal.main.appendSE('g'),
				calcY=thisGlobal.calcY,
				color=thisGlobal.color,
				
				/*gradient=thisGlobal.svg.appendSE('defs').appendSE('linearGradient',{
					id: 'gradient',
					x1: 0, y1: 0,
					x2: 0, y2: 1
				}),*/
				d='M',
				lineCoord={
					x: [],
					y: []
				};
			
			/*[0,1].forEach(function(v){	//添加线性渐变
				gradient.appendSE('stop',{
					offset: v,
					'stop-color': color.gradient[v]
				})
			});*/
			
			thisGlobal.time.forEach(function(v,i){	//计算分时图线段的d值
				var x=MathFloor(oneSpaceWidth*i),
					y=calcY( v[2] )+29;
				
				d+=x+' '+y+' ';
				lineCoord.x.push( x );
				lineCoord.y.push( y );
			});
			
			timeG.appendSE('path',{		//分时图渐变背景
				d: d+'V'+MathFloor(thisGlobal.svgHeight-20)+'H0',
				fill: color.blue,
				opacity: .2
			});
			timeG.appendSE('path',{		//分时图线段
				d: d,
				fill: 'none',
				stroke: color.blue,
				'stroke-width': 2
			});
			
			$.extend(thisGlobal,{
				timeG: timeG,
				lineCoord: lineCoord
			});
		},
		flashDot:function(){
			var thisGlobal=this.global,
				lineCoord=thisGlobal.lineCoord,
				lastIndex=thisGlobal.lastIndex,
			
				flashDot=thisGlobal.main.appendSE('circle',{
					class: 'capi-dynamic',
					cx: lineCoord.x[lastIndex],
					cy: lineCoord.y[lastIndex],
					r: 4,
					fill: thisGlobal.color.gradient[0]
				});
			
			$.extend(thisGlobal,{
				flashDot: flashDot
			});
		},
		bar:function(){
			var thisGlobal=this.global,
				barHeight=thisGlobal.barHeight,
				lineXCoord=thisGlobal.lineCoord.x,
				
				time=thisGlobal.time,
				barG=thisGlobal.main.appendSE('g',{
					transform: 'translate(0,'+MathFloor(thisGlobal.gradientHeight+30)+')',
					fill: thisGlobal.color.blue
				}),
				
				max=[],
				barYCoord=[],
				barScale;
			
			time.forEach(function(v,i){
				max.push( v[1] )
			});
			max=arrMax( max );	//计算成交量最大值
			barScale=barHeight/max;
			
			time.forEach(function(v,i){		//添加柱状图
				var h=MathFloor(v[1]*barScale),
					y;
					
				h<0 && (h=0);	//处理高度小于零报错 - 兼容
				y=MathFloor(barHeight-h);
				barG.appendSE('rect',{
					x: lineXCoord[i],
					y: y,
					width: 1,
					height: h
				});
				barYCoord.push( y );	//成交量Y轴坐标，hover时用，记得加上translateY
			});
			
			$.extend(thisGlobal,{
				maxVol: max,
				barG: barG,
				barYCoord: barYCoord,
				barScale: barScale,
				barHeight: barHeight
			});
		},
		xAxis:function(){
			var thisGlobal=this.global,
				settings=thisGlobal.settings,
				svgHeight=thisGlobal.svgHeight,
				oneSpaceWidth=thisGlobal.oneSpaceWidth,
				y=svgHeight-20,
				
				bgG=thisGlobal.bgG,
				xG=thisGlobal.main.appendSE('g',{
					transform: 'translate(0,'+(svgHeight-6)+')'	//-20+14=6
				});
			
			['09:30', '10:30', '11:30 / 13:00', '14:00', '15:00'].forEach(function(v,i){
				var x=0,
					anchor='middle';
				switch(i){
					case 0:
						anchor='start';
						break;
					case 4:
						anchor='end';
						x=thisGlobal.svgWidth;
						break;
					default:
						x=addPointFive(oneSpaceWidth*60*i);
						bgG.appendSE('path',{
							d: 'M'+x+' 29.5 '+x+' '+y
						});
				}
				xG.appendSE('text',{
					x: x,
					'text-anchor': anchor
				}).text(v);
			});
		},
		zero:function(){
			var thisGlobal=this.global,
				svgWidth=thisGlobal.svgWidth,
				lineHeight=thisGlobal.lineHeight,
				zeroY=MathFloor(lineHeight/2)+29.5,
				color=thisGlobal.color,
				zeroG=thisGlobal.main.appendSE('g');
			
			zeroG.appendSE('path',{		//零界线
				d: 'M0 '+zeroY+' '+svgWidth+' '+zeroY,
				stroke: color.zero,
				'stroke-dasharray': 6
			});
			zeroG.appendSE('text',{		//零界文本
				x: svgWidth-2,
				y: zeroY-4,
				'text-anchor': 'end'
			}).text('0.00%');
		},
		icon:function(){
			createIcon(this.global, 1);
		},
		move:function(){
			timeMove(this.global, 'time');
		},
		update:function(msg){
			var thisGlobal=this.global,
				lastIndex=thisGlobal.lastIndex,
				barHeight=thisGlobal.barHeight,
				barScale=thisGlobal.barScale,
				
				maxZdf=thisGlobal.maxZdf,
				maxVol=thisGlobal.maxVol,
				
				close=msg.close,
				timeVol=msg.timeVol,
				zdf=msg.zdf,
				
				hasTrueVol=1,	//用于判断是否存在成交量，并且更新的成交量小于最大成交量
				time=WIN.syncChartsData.time,
				
				barG,
				timePath,
				linePath,
				oldD,
				newX,
				newY,
				newD,
				lineCoord;
				
			/*msg={
					close: "15.2",	//当前收盘价
					closed: "67.25",	//前一天的收盘价
					code: "600000",
					date: "2015-07-12",
					high: "17.6",
					low: "16.77",
					name: '浦发银行',
					open: '17.00',
					time: '11:38',
					timeVol: 1306600,
					vol: 104985441,
					zde: '-0.25',
					zdf: '-1.47'
			}*/
			
			time.xAxis.push( msg.date+' '+msg.time );			//同步x轴日期
			time.series.data.push( [close, timeVol, zdf] );		//同步分时数据
			
			if(maxVol && timeVol>maxVol ){		//当有成交量并且成交量大于最大值时，重绘
				hasTrueVol=0
			}
			if(zdf<=maxZdf && zdf>=-maxZdf && hasTrueVol ){	//当成交量不需要重绘，且zdf在最大最小zdf之间，重新计算最后一个点
				timePath=$('path',thisGlobal.timeG);
				linePath=timePath.eq(1);	//分时线
				
				oldD=linePath.attr('d');
				newX=MathFloor(thisGlobal.oneSpaceWidth*++thisGlobal.lastIndex);	//顺便更新lastIndex的数值
				newY=thisGlobal.calcY( zdf )+29;
				newD=oldD+newX+' '+newY+' ';
				
				
				lineCoord=thisGlobal.lineCoord;
				lineCoord.x.push( newX );
				lineCoord.y.push( newY );
				
				timePath.eq(0).attr({	//背景
					d: newD+'V'+MathFloor(thisGlobal.svgHeight-20)+'H0'
				});
				linePath.attr({	//分时线
					d: newD
				});
				thisGlobal.flashDot.attr({	//动态更新圆点
					cx: newX,
					cy: newY
				});
				
				if(maxVol){	//成交量更新
					var barG=thisGlobal.barG,
						barH=MathFloor(timeVol*barScale),
						barY;
						
					barH<0 && (barH=0);
					barY=MathFloor(barHeight-barH);
					barG.appendSE('rect',{
						x: newX,
						y: barY,
						width: 1,
						height: barH
					});
					thisGlobal.barYCoord.push( barY );
				}
			}else{
				WIN.redraw.time( time )
			}
		}
	};
	/******************************** Linechart END **************************************/
	function timeMove(thisGlobal, type){	//分时图，事件图移动事件
		var oneSpaceWidth=thisGlobal.oneSpaceWidth,
			box=thisGlobal.box,
			boxOffsetLeft=thisGlobal.boxOffsetLeft,
			color=thisGlobal.color.dot,
			
			aTspan=thisGlobal.title.find('tspan'),
			maskG=thisGlobal.main.appendSE('g'),
			mask=maskG.appendSE('rect',{
				x: 0,
				y: 30,
				width: thisGlobal.svgWidth,
				height: thisGlobal.svgHeight-50,
				fill: 'transparent'
			}),
			dotLine=maskG.appendSE('circle',{
				cx: 0,
				cy: 0,
				r: 4,
				fill: color,
				visibility: 'hidden'
			}),
			dotBar,
			dotBarY;
		
		thisGlobal.settings.hasBar && ( dotBar=maskG.appendSE('circle',{
			cx: 0,
			cy: 0,
			r: 4,
			fill: color,
			visibility: 'hidden'
		}), dotBarY=thisGlobal.gradientHeight+30 );
		
		$WIN.on('resize.timechart',throttle(function(){	//窗口改变，盒子距离相应改变
			var boxOffset=box.offset();
			boxOffsetLeft=boxOffset.left;
		},100));
		
		
		var lineCoord=thisGlobal.lineCoord;
		if('time'==type){			//分时图
			var time=WIN.syncChartsData.time;
		}else{						//事件页面类分时图
			var xAxis=thisGlobal.settings.xAxis;
			var data=thisGlobal.data;
		}
		
		mask.on('mousemove',function(e){
			
				/*time=WIN.syncChartsData.time,
				data=time.series.data,*/
			
			var i=MathRound( (e.pageX-boxOffsetLeft)/oneSpaceWidth ),	//鼠标到svg的距离除以240得出第几个点
				x=lineCoord.x[i];
			
			if(x!=UNDEFINED){	//x坐标值不存在兼容处理
				dotLine.attr({	//分时图圆点移动
					cx: x,
					cy: lineCoord.y[i],
					visibility: 'visible'
				});
				
				dotBar && dotBar.attr({	//判断是否存在成交量及显示
					cx: x,
					cy: thisGlobal.barYCoord[i]+dotBarY,
					visibility: 'visible'
				});
				
				if('time'==type){
					data=time.series.data;
					
					aTspan.eq(1).text( time.xAxis[i] );				//时间
					aTspan.eq(3).text( data[i][0] );				//价格
					aTspan.eq(5).text( formatVol( data[i][1] ) );	//成交量
					aTspan.eq(7).text( data[i][2]+'%' );			//涨跌幅
				}else{
					aTspan.eq(1).text( xAxis[i] );				//时间
					aTspan.eq(2).text( data[i] );					//值
				}
				
			}else{
				mask.trigger('mouseout');
			}
			
		}).mouseout(function(){
			[dotLine, dotBar].forEach(function(v){
				v && v.attr('visibility','hidden')	//window改变太快及是否存在显示成交量处理
			})
		});
	}
	function createIcon(thisGlobal, isTime){
		var lineCoord=thisGlobal.lineCoord,
			xCoord=lineCoord.x,
			yCoord=lineCoord.y,
			
			boxOffsetLeft=thisGlobal.boxOffsetLeft,
			boxOffsetTop=thisGlobal.boxOffsetTop,
			dragG=thisGlobal.dragG,
			icon=thisGlobal.settings.series.icon,
			allIconHtml=[];
			
		icon.forEach(function(v,j){	//v：每一个icon的名字，例如[a1,a2], j当前数据在数组的索引，用于后面找index
			v.name.forEach(function(v,i){	//v：当前icon的文本值，i：当前的索引，用以计算path线段的d属性的高
				var index=icon[j].index,
					translateX=xCoord[index],
					translateY=yCoord[index],
					lineHeight=10+i*18,
					str;
				
				dragG.appendSE('path',{
					id: 'capi-ev-'+v,
					d: 'M0 0 0 -'+lineHeight,	//规定每个path线段的高度为10，以后的为10+i*18（icon的高度-2底部边框）
					transform: 'translate('+translateX+','+translateY+')'
				});
				
				str=createEvIcon({
					boxOffsetLeft: boxOffsetLeft,
					boxOffsetTop: boxOffsetTop,
					iconHtml: v,	//icon的文本内容，用于显示
					title: icon[j].title[i],	//事件压缩内容的标题
					nid: icon[j].nid[i],	//用于后端
					iconInSvgleft: translateX-10,	//icon在svg中左边距离，用于定位icon在html中的left，以下同理
					iconInSvgTop: translateY-lineHeight-19 	//icon距离顶部的距离-线的高度-icon的高度
				}, isTime);	//表示分时
				allIconHtml.push(str);
			});
		});
		$BODY.append( allIconHtml.join('') );
	}
	
	function Evtlinechart(box,options){
		this.settings(box, options)
	}
	
	Evtlinechart.prototype={
		settings:function(box,Options){		//配置
			var _this=this,
				settings=$.extend(true,{
					style: {
						font: '12px "\\5FAE\\8F6F\\96C5\\9ED1"',
						overflow: 'hidden',
						'box-sizing': 'border-box',
					},
					title:'市场关注度走势',
					xAxis: [],
					series: {}
				},Options),
				svg=box.appendSE('svg',{
					width:'100%',
					height:'100%',
					xmlns:SVG.ns
					
				}).css(settings.style),
				svgWidth=svg.width(),
				svgHeight=svg.height(),
				gradientHeight=svgHeight-50,	//渐变高度，20（xAxis）+ 30（title）
				fontSize=pInt( svg.css('font-size') ),
			
				main,
				xLength,
				lastIndex,
				series,
				data,
				color;
			
			if( svgWidth<10 || svgHeight<80 ) return svg.remove();	//当盒子宽高不够以无法显示图形时，不绘图
			/******************* 以上基本参数配置 *****************************/
			
			main=createSE('g');	//创建整体
			
			xLength=settings.xAxis.length;	//x轴数据长度
			lastIndex=xLength-1;			//x轴最后一个数据在数组里的索引
			series=settings.series;
			data=series.data;
			color={
				gray: '#ccc',	//背景线 - 灰色
				blue: 'rgba(0, 52, 116, .8)',	//成交量及分时线段 - 浅蓝色 
				dragLine: '#333',	//拖拽线 - 深黑色
				dot: '#418fcf',		//圆点 - 蓝色
				gradient: ['#3D6AA9', 'rgba(61, 106, 169, 0)']	//top - 蓝色, bottom - 蓝色透明
			};
			
			_this.global={
				box: box,
				svg: svg,
				main: main,
				settings: settings,
				series: series,
				data: data,
				svgWidth: svgWidth,
				svgHeight: svgHeight,
				gradientHeight: gradientHeight,
				fontSize: fontSize,
				xLength: xLength,
				lastIndex: lastIndex,
				color: color
			};
			
			_this.init();
			svg.append( main );
		},
		init:function(){	//初始化各种变量值
			var _this=this,
				thisGlobal=this.global,
				settings=thisGlobal.settings,
				
				box=thisGlobal.box,
				boxOffset=box.offset(),
				boxOffsetLeft=boxOffset.left,
				boxOffsetTop=boxOffset.top,
				
				svgHeight=thisGlobal.svgHeight,
				gradientHeight=thisGlobal.gradientHeight,
				lineHeight=gradientHeight*.86,	//让其与背景保持一定的距离
				
				oneSpaceWidth=thisGlobal.svgWidth/thisGlobal.lastIndex,
				maxMin=[];
			
			thisGlobal.data.forEach(function(v){
				maxMin.push( v-0 )
			});
			maxMin=arrMaximin( maxMin );
			var max=maxMin.max;
				
			$.extend(this.global,{
				boxOffsetLeft: boxOffsetLeft,
				boxOffsetTop: boxOffsetTop,
				gradientHeight: gradientHeight,
				lineHeight: lineHeight,
				oneSpaceWidth: oneSpaceWidth,
				calcY:function(){
					var scale=lineHeight/(max-maxMin.min);
					return function(cur){
						return MathFloor( (max-cur) * scale )
					}
				}()
			});
			_this.method();
		},
		method:function(){	//方法调用
			with(this){
				bg();
				dragLine();
				title();
				marketLineShape();
				xAxis();
				global.settings.series.icon[0] && icon();
				move();
			}
		},
		bg:function(){
			var thisGlobal=this.global,
				svgWidth=thisGlobal.svgWidth,
				bgG=thisGlobal.main.appendSE('g',{
					stroke: thisGlobal.color.gray,
				});
				
			var bottomLineY=thisGlobal.svgHeight-20.5;
			bgG.appendSE('path',{		//创建低端分界横线
				d: 'M0 '+bottomLineY+' '+svgWidth+' '+bottomLineY,
			});
			
			$.extend(thisGlobal,{
				bgG: bgG
			});
		},
		dragLine:function(){
			var thisGlobal=this.global,
				dragG=thisGlobal.main.appendSE('g',{
					stroke: thisGlobal.color.dragLine
				});
			$.extend(thisGlobal,{
				dragG: dragG
			});
		},
		title:function(){
			var thisGlobal=this.global,
				settings=thisGlobal.settings,
				lastIndex=thisGlobal.lastIndex,
				data=thisGlobal.data,
				
				title=createTitle(
					thisGlobal.fontSize,
					thisGlobal.main,
					[
						settings.title,				//标题
						settings.xAxis[lastIndex],	//日期
						data[lastIndex]				//数值
					]
				);
			$.extend(thisGlobal,{
				title: title
			});
		},
		marketLineShape:function(){
			var thisGlobal=this.global,
				gradientHeight=thisGlobal.gradientHeight,	//渐变背景的高度
				oneSpaceWidth=thisGlobal.oneSpaceWidth,
				
				lineG=thisGlobal.main.appendSE('g'),
				calcY=thisGlobal.calcY,
				color=thisGlobal.color,
				
				gradient=thisGlobal.svg.appendSE('defs').appendSE('linearGradient',{
					id: 'gradient',
					x1: 0, y1: 0,
					x2: 0, y2: 1
				}),
				d='M',
				lineCoord={
					x: [],
					y: []
				};
			
			[0,1].forEach(function(v){	//添加线性渐变
				gradient.appendSE('stop',{
					offset: v,
					'stop-color': color.gradient[v]
				})
			});
			
			thisGlobal.data.forEach(function(v,i){	//计算线段的d值
				var x=MathFloor(oneSpaceWidth*i),
					y=calcY( v )+29;
				
				d+=x+' '+y+' ';
				lineCoord.x.push( x );
				lineCoord.y.push( y );
			});
			
			lineG.appendSE('path',{		//分时图渐变背景
				d: d+'V'+MathFloor(gradientHeight+29.5)+'H0',
				fill: 'url(#gradient)'
			});
			lineG.appendSE('path',{		//分时图线段
				d: d,
				fill: 'none',
				stroke: color.blue,
				'stroke-width': 1
			});
			
			$.extend(thisGlobal,{
				lineG: lineG,
				lineCoord: lineCoord
			});
		},
		xAxis:function(){
			var thisGlobal=this.global,
				svgHeight=thisGlobal.svgHeight,
				xAxis=thisGlobal.settings.xAxis,
				bgG=thisGlobal.bgG,
				xG=thisGlobal.main.appendSE('g',{
					transform: 'translate(0,'+(svgHeight-6)+')'	//-20(x轴高度)+14(字体向下距离)=6
				});
			
			var space=MathRound(thisGlobal.xLength/3),	//计算4个x轴日期的间距
				x,
				textAnchor,
				text;
			
			for(var i=0; i<4; i++){
				switch(i){
					case 0:
						x=0;
						text=xAxis[0];
						textAnchor='start';
						break;
					case 3:
						x=thisGlobal.svgWidth-.5;
						text=xAxis[ thisGlobal.lastIndex ];
						textAnchor='end';
						break;
					default:
						var index=space*i;
						x=thisGlobal.lineCoord.x[ index ]+.5;
						text=xAxis[ index ];
						textAnchor='middle';
				}
				i && bgG.appendSE('path',{
						d: 'M'+x+' '+(svgHeight-27)+' '+x+' '+(svgHeight-20)
					});
				
				xG.appendSE('text',{
					x: x,
					'text-anchor': textAnchor
					
				}).text( text ? text : i );
			}
		},
		icon:function(){
			createIcon(this.global)
		},
		move:function(){
			timeMove(this.global)
		}
	};
	
	/****************************** Evtlinechart END ************************************/
	
	/**
	 * 	事件内容压缩的点击展示
	 * 	图表icon的点击事件，移入事件等，对应左侧事件箱的li获得焦点,右侧移入，相应icon获得焦点，点击亦如此
	 * 	$DOC.on('dblclick','.charts',function(){...})：chart盒子双击关闭全部窗口
	 */
	(function(){
		var evtBox=$('.event'),
			evtBoxHeight=evtBox.outerHeight(),
			oldLi,
			oldIcon;
		
		$DOC.off('click.charts');	//当点击页面的时候，$DOC添加了N次click.charts事件，清空保持程序的正常
		
		$DOC.on('mouseover.charts','.capi-evIcon',function(){
			var curLi=$('[data-capi-evt="'+$(this).attr('id').substring(4)+'"]',evtBox);
			//if( curLi.hasClass('active') ) return;
			
			focusClass( 1, curLi, 'active' );
			focusViewArea( curLi );
		}).on('dblclick.charts','.charts',function(){
			$('.capi-evInfo, .capi-ev-timeInfo, .capi-timeChart, .capi-notice, .capi-trade').trigger('dblclick.charts');
			
		}).on('click.charts','.capi-evIcon',function(){		//K线 - 事件内容压缩的点击展示
			iconClick( $(this) )
		}).on('click.charts','.capi-ev-timeIcon',function(){		//分时 - 事件内容压缩的点击展示
			iconClick( $(this),1 )
		});
		
		evtBox.on('mouseover.charts','li[data-capi-evt]',function(){	//事件可以合并到$DOC里，减少事件绑定
			var curLi=$(this),
				curIcon;
			//if(!curLi.attr('id')) return;	//四大指数没有icon，兼容处理
			//if( curLi.hasClass('active') ) return;	//移入同一个事件效果，阻止执行，节约性能,会出现问题，缓用
			curIcon=$( '#nid-'+curLi.attr('data-capi-evt') );
				
			focusClass( 1, curLi, 'active' );
			focusClass( 0, curIcon, 'capi-evActive' );
			
		}).on('mouseleave.charts',function(){	//移入让icon失去焦点
			oldIcon && oldIcon.removeClass('capi-evActive')
			
		}).on('click.charts','li[data-capi-evt]',function(e){	//点击触发icon自身的click事件，以弹出压缩事件内容
			evtClick( $(this), $( '#nid-'+$(this).attr('data-capi-evt') ) )
			
		}).on('click.charts','li[data-capi-notice]',function(e){	//点击触发公告click事件
			evtClick( 
				$(this),
				$(this).data('show') ?
				$( '.notice-'+$(this).attr('data-capi-notice') ) :
				$( '#notice-'+$(this).attr('data-capi-notice') )
			)
			
		}).on('click.stopEvt','a',function(e){	//阻止点击事件箱a链接，弹出压缩内容窗口
			e.stopPropagation()
			
		});
		
		function evtClick( _this, showElem ){
			var on=_this.data('show');
			
			on ? showElem.trigger('dblclick') : showElem.click();
			_this.data('show', !on)
		}
		
		function iconClick(_this, type){	//压缩内容图标点击事件，分为K线图标，和分时图标，不同的点击事件，因为在动态更新时要删除icon，所以创建时要区分开来
			var dis=_this.data('dis'),
				title,
				oldHtml,
				dragLine,
				transform,
				x,
				y,
				left,
				top,
				oldDragLine_d,
				$WinWidth,
				$WinHeight,
				boxOffset,
				boxOffsetLeft,
				boxOffsetTop;
				
			if( dis ){
				title=dis.title,
				oldHtml=dis.oldHtml,
				dragLine=dis.dragLine,
				x=dis.x;
				y=dis.y;
				left=dis.left;
				top=dis.top;
				oldDragLine_d=dis.oldDragLine_d;
				$WinWidth=dis.$WinWidth;
				$WinHeight=dis.$WinHeight;
				boxOffsetLeft=dis.boxOffsetLeft;
				boxOffsetTop=dis.boxOffsetTop;
			}else{
				title=_this.attr('title'),
				oldHtml=_this[0].textContent,
				dragLine=$( DOC.getElementById('capi-ev-'+oldHtml) ),	//原生js快于jQuery查询
				transform=dragLine.attr('transform');
				x=+transform.replace(/.+\((.+)[,| ].+/,'$1');	//[,| ]处理ie：translate(383.5 164)
				y=+transform.replace(/.+[,| ](.+)\)/,'$1');
				left=_this.css('left');
				top=_this.css('top');
				oldDragLine_d=dragLine.attr('d');
				$WinWidth=$WIN.width();
				$WinHeight=$WIN.height();
				boxOffset=dragLine.parents('svg').parent().offset();
				boxOffsetLeft=boxOffset.left;
				boxOffsetTop=boxOffset.top;
				_this.data('dis',{		//数据缓存，以便不每次都计算
					title: title,
					oldHtml: oldHtml,
					dragLine: dragLine,
					x: x,
					y: y,
					left: left,
					top: top,
					oldDragLine_d: oldDragLine_d,
					$WinWidth: $WinWidth,
					$WinHeight: $WinHeight,
					boxOffsetLeft: boxOffsetLeft,
					boxOffsetTop: boxOffsetTop
				});
			}
			
			createShow('', '', _this, dragLine, {
				$WinWidth: $WinWidth,
				$WinHeight: $WinHeight,
				boxOffsetLeft: boxOffsetLeft,
				boxOffsetTop: boxOffsetTop,
				translateX: x,
				translateY: y,
				title: title,
				oldLeft: left,
				oldTop: top,
				oldHtml: oldHtml,
				oldDragLine_d: oldDragLine_d,
				type: type		//供createShow时判断是【分时压缩事件】还是【K线压缩事件】
			}, 2);
		}
		
		function focusClass(oldType, cur, className){
			var old= oldType ? oldLi : oldIcon ;
			old && old.removeClass( className );
			cur.addClass( className );
			
			if(oldType){
				oldLi=cur
			}else{
				oldIcon=cur
			}
		}
		
		function focusViewArea(_this){
			if( !_this.lenght ){
				return;
			}
			var t=_this.position().top,
				h=_this.outerHeight(),
				s=evtBox.scrollTop();
			
			/**
			 * 	(t>=s && (t+h)<=s+evtBoxHeight)元素在可视区内
			 * 	t<s ? 在上面 : 在下面
			 */
			if(t<s || (t+h)>s+evtBoxHeight){
				t<s ? evtBox.scrollTop(t) : evtBox.scrollTop(t+h-evtBoxHeight)
			}
		}
	})();
	
	//评论
	(function(){
		function setNum(elem,str1,str2){
			var html=elem.html();
			elem.html( str1+(html.substring(3,html.length-1)-0+1)+str2 );
		}
		function createSecReplay(comment,box,replay){
			box.prepend('<li>'+
		    				'<div class="user">'+
								'<div class="content">'+
						    		'<p class="blue-text">'+comment.send_nickname+(comment.to_nickname ? ' 回复 '+comment.to_nickname : '')+'</p>'+
						    		'<div>'+comment.content+'</div>'+
						    		'<div class="clearfix reply-time">'+
						    			'<time class="fl">'+comment.addtime+'</time>'+
						    			'<span id="show-'+comment.id+'" class="fr">回复</span>'+
						    		'</div>'+
						    	'</div>'+
						    	'<div id="reply-'+comment.id+'" class="reply-user lightgray-bg-color">'+
					    			'<div>'+
					    				'<textarea class="form-control"></textarea>'+
					    				'<div>'+
					    					'<i class="btn btn-default" data-newsId="'+comment.sid+'" data-replay="'+comment.id+'" data-type="2">回复</i>'+
					    				'</div>'+
					    			'</div>'+
						    	'</div>'+
							'</div>'+
		    			'</li>');
		   	setNum(replay,'回复(',')');
		   	setNum(replay.parents('.comment-list').prev().find('p'),'评论（','）');
		}
		
		$DOC.on('click.capiComment','[class^=capi-ev] .reply-time span',function(){
			$('#reply-'+$(this).attr('id').substring(5)).stop().slideToggle();
			
		}).on('click.capiComment','[class^=capi-ev] .btn-default',function(){
			var _this=$(this),
				parent=_this.parent(),
				textarea=parent.prev(),
				val=textarea.val().trim(),
				len=val.length;
				
			if(len<5){
				alert('评论不能少于5个字');
				return
			}
			if(len>500){
				alert('评论不能大于500个字');
				return
			}
			
			$.ajax({
				type: 'POST',
				url: siteUrl + 'message/comment_add',
				data: {
					content: val,
					news_id: _this.attr('data-newsId'),
					news_reply: _this.attr('data-replay')
				},
				dataType: 'json'
				
			}).done(function(msg){
				switch(msg.status){
					case 404:	//未登录处理
						showLoginModal();	//外部登录框
						return;
					case 700:	//返回成功的数据
						var comment=msg.comment;
						switch(_this.attr('data-type')){
							case '0':		//发布层
								_this.parents('.comment-submit').next()
								.prepend('<li class="wrap clearfix">'+
											'<div class="content">'+
									    		'<p class="blue-text">'+comment.send_nickname+(comment.to_nickname ? ' 回复 '+comment.to_nickname : '')+'</p>'+
									    		'<div>'+comment.content+'</div>'+
									    		'<div class="clearfix reply-time">'+
									    			'<time class="fl">'+comment.addtime+'</time>'+
									    			'<span id="show-'+comment.id+'" class="fr">回复(0)</span>'+
									    		'</div>'+
									    	'</div>'+
									    	
									    	'<div id="reply-'+comment.id+'" class="reply-user lightgray-bg-color">'+
								    			'<div>'+
								    				'<textarea class="form-control"></textarea>'+
								    				'<div>'+
								    					'<i class="btn btn-default" data-newsId="'+comment.sid+'" data-replay="'+comment.id+'" data-type="1">回复</i>'+
								    				'</div>'+
								    			'</div>'+
									    		'<ol class="user-sec"></ol>'+
									    	'</div>'+
									     '</li>');
								setNum(parent.parents('.comment-submit').find('p'),'评论（','）');
								break;
							case '1':		//第一层回复
								createSecReplay(comment, parent.parent().next(), parent.parents('.reply-user').prev().find('.reply-time span'));
								break;
							case '2':		//第二层回复
								var box=parent.parents('.user-sec');
								createSecReplay(comment, box, box.parent().prev().find('.reply-time span'));
								break;
						}
						textarea.val('');
						break;
				}
			})
		});
	})();
	
	
	$.fn.extend({
		capiDrag:function(Options){
			var _this=$(this),
				d=$DOC,
				win=$WIN;
			
			return _this.mousedown(function(e){
				if(e.target.tagName.toLowerCase()!='textarea'){	//防止评论的textarea失效
					_this.css('zIndex', ++GLOBAL.zIndex );
					var offset=_this.offset(),
						disX=e.pageX-offset.left,
						disY=e.pageY-offset.top;
					
					Options.down && Options.down.call( this, disX, disY, e );
					d.on('mousemove.drag',throttle(function(arg){
						var e=arg[0],
							l=e.pageX-disX,
							t=e.pageY-disY;
						
						_this.css({
							left: l,
							top: t
						});
						
						Options.move && Options.move.call( this, l, t );
					},0,26)).on('mouseup.drag',function(){
						
						d.off('mousemove.drag mouseup.drag');
						Options.up && Options.up.apply( this, arguments );
					});
					
					return false
				}
			})
		},
		/********************************** Html Element Method *******************************************/
		appendSE:function(sElem,oAttr){		//创建svg类型元素并将其添加到$(this)元素中
			return createSE( sElem ).attrSE(oAttr).appendTo( $(this) )
		},
		attrSE:function(oAttr){		//设置带xlink:href的SVGElement标签属性
			return $(this).each(function(){
				if(oAttr){
					for(var i in oAttr){
						i=='xlink:href' ?
						this.setAttributeNS(SVG.xlink,i,oAttr[i]) :
						this.setAttribute(i,oAttr[i])
					}
				}else{	//当attr不存在时跳出循环
					return true
				}
			})
		},
		Ycharts:function(Options){
			var _this=$(this).eq(0),	//处理jQuery的兼容，多个对象创建图表时，图表事件会出现错误(输出事件对象只返回了一个对象)
				type=Options.type,
				t;
			switch(type && type.trim()){
				case 'time':
					t='Time';
					break;
					
				case 'k':
					t='K';
					break;
					
				case UNDEFINED:
				case 'line':
					t='Line';
					break;
					
				case 'evtline':
					t='Evtline';
					break;
					
				default:
					throw new TypeError( type+' is not defined' );
			}
			
			$('.capi-loading-svg',_this).remove();	//删除loading动画
			return GLOBAL[t+'chart']=eval('new '+t+'chart(_this,Options)'), _this
			//return new THIS[t+'chart'](_this,Options), _this
		}
	});
});
