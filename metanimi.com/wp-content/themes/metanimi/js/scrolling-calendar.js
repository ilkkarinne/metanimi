"use strict";

//"Package" definitions
var com = com || {};
com.metanimi = com.metanimi || {};

// Module ScrollingCalendar:
com.metanimi.ScrollingCalendar = (function() {
	
	var _container;
	var _scroller;
	var _pages = [];
	var _weeksPerPage = 6;
	var _weekContainerHeight = 140;
	var _pageHeight = _weeksPerPage * _weekContainerHeight;
	var _dayHeight = 140;
	var _dayWidth = 170;
	var _thumbWidth = 150;
	var _thumbHeight = 84;
	var _minLimit;
	var _minTime;
	var _maxTime;
	var _topPageTime;
	var _topPageIndex = 0;
	var _timeChangeListeners = [];
	var _monthThumbsUrlResolver;
	var _selectedTime = moment();
	var scrollingCalConst;
	
	
	
	function init(containers, minTime, maxTime){
		_minTime = minTime;
		_minLimit = moment(minTime).subtract('month',6);
		_maxTime = maxTime;
		var timeSpanWeeks = maxTime.diff(_minLimit,'weeks')+1;
		var totalHeight = timeSpanWeeks * _weekContainerHeight; 
		_scroller = $('<div></div>').css({'position':'relative','top':'0px','left':'0px','width':'100%','height':_pageHeight+'px','overflow-y':'scroll','overflow-x':'hidden'});
		_container = $('<div></div>').css({'position':'absolute','top':'0px','left':'0px','width':'100%','height':totalHeight+'px','margin':'10px'});
		_scroller.append(_container);
		var heading = $('<h2></h2>').addClass('calheading').text('Index');
	    var closeButton = $('<i></i>').addClass('close-button fa fa-times-circle');
	    closeButton.on('click', function(e){
		dayWasClicked(null);
	    });
	    heading.append(closeButton);
		containers.append(heading);
		containers.append(_scroller).css({'overflow':'hidden'});
		
		buildPages();
		
		_scroller.on('scroll', function(e){
			var viewportTop = _scroller.scrollTop();
			var viewportBottom = viewportTop + _scroller.height();
			var topPageTop = _pages[_topPageIndex].elem.position().top;
			var bottomPageBottom = topPageTop + 3 * _pageHeight;
			var couldMove = true;
			while (couldMove && ((bottomPageBottom-viewportBottom) < _pageHeight*0.5)){
				couldMove = moveTopPageToBottom();
				bottomPageBottom = _pages[_topPageIndex].elem.position().top + 3 * _pageHeight;
			}

			while (couldMove && ((viewportTop-topPageTop) < _pageHeight*0.5)){
				couldMove = moveBottomPageToTop();
				topPageTop = _pages[_topPageIndex].elem.position().top;
			}
			
		});
	}
	
	function buildPages(){
		var page,i,j,k,week,day,label,thumb;
		for (i=0;i<3;i++){
			page = {
				elem: $('<div></div>').attr('style','position:absolute;top:0;left:0;width:100%;height:'+(_weeksPerPage*_weekContainerHeight)+'px').attr('id','page-'+i),
				weeks: []
			};
			for (j=0;j<_weeksPerPage;j++){
				week = {
					elem: $('<div></div>').attr('style','width:100%;height:'+_weekContainerHeight+'px').addClass('week'),
					days:[]
				};				
				for (k=0;k<7;k++){
					day = {
						elem: $('<div></div>').css({
							'display':'inline-block',
							'width':_dayWidth+'px',
							'height':_dayHeight+'px',
							'overflow':'hidden'
						}).addClass('day')
					};
					label = $('<span></span>').css({
						'max-height':'15px',
						'display':'block',
						'margin-top':'5px',
						'margin-right':'5px'
					}).addClass('label');
					thumb = $('<div></div>').css({
							'width':_thumbWidth+'px',
							'height':_thumbHeight+'px',
							'background-position':'0px 0px',
							'background-repeat':'no-repeat',
							'margin-left':'auto',
							'margin-right':'auto',
							'margin-top':'20px'
					}).addClass('thumb');
					day.elem.append(label);
					day.elem.append(thumb);
					
					day.elem.on('click', function(e){
						var elem = $(e.delegateTarget);
						if (!elem.prop('data-disabled')){
							dayWasClicked(moment(elem.prop('data-time'),'YYYY-MM-DD'));							
						}
					});
					week.days.push(day);
					week.elem.append(day.elem);
				}
				page.weeks.push(week);
				page.elem.append(week.elem);
			}
			_pages.push(page);
			_container.append(page.elem);
		}
	}
	
	function dayWasClicked(day){		
		_.each(_timeChangeListeners,function(listener){
			listener(day);
		})
	}	
			
	function populateWeek(week,firstDayTime){
		var t = moment(firstDayTime);
		_.each(week.days,function(day){
			day.elem.attr('title',t.format('dddd, MMMM Do YYYY'));
			day.elem.find('.label').text(getLabelFor(t));
			day.elem.find('.thumb').css({'background-image':'url('+getMonthThumbsUrl(t)+')','background-position':'-'+getMonthThumbSpritePos(t)+'px 0px'});
			day.elem.prop('data-time',t.format('YYYY-MM-DD'));
			if (t.isBefore(_minTime,'day')){
				day.elem.addClass('notallowed');
				day.elem.prop('data-disabled',true);
				day.elem.css({'cursor':'not-allowed'});
			}
			else if (t.isAfter(_maxTime,'day')){
				day.elem.addClass('notallowed');
				day.elem.prop('data-disabled',true);
				day.elem.css({'cursor':'not-allowed'});
			}
			else {
				day.elem.removeClass('notallowed');
				day.elem.prop('data-disabled',false);
				day.elem.css({'cursor':'pointer'});
			}
			if (t.isSame(_selectedTime,'day')){
				day.elem.addClass('selected');
			}
			else {
				day.elem.removeClass('selected');
			}
			if (t.date() === 1){
				day.elem.addClass('monthbegin');
			}
			else {
				day.elem.removeClass('monthbegin');
			}
			if (t.dayOfYear() === 1){
				day.elem.addClass('yearbegin');
			}
			else {
				day.elem.removeClass('yearbegin');
			}
			if (t.day() === 0){
				day.elem.addClass('sunday');
			}
			else {
				day.elem.removeClass('sunday');
			}
			if (t.day() === 6){
				day.elem.addClass('saturday');
			}
			else {
				day.elem.removeClass('saturday');
			}
			t.add('days',1);
		});
	}
		
	function getLabelFor(time){
		var label = '';
		if (time.dayOfYear() === 1){
			label = time.format('YYYY');
		}
		if (time.date() === 1){
			label += ' '+time.format('MMMM');
		}
		label += ' '+time.format('Do');
		return label;
	}
	
	function getMonthThumbsUrl(time){
		if (_monthThumbsUrlResolver){
			return _monthThumbsUrlResolver(time);
		}
		else {
			return '';
		}
	}
	
	function getMonthThumbSpritePos(time){
		var dayOfMonth = time.date();
		return (dayOfMonth-1)*_thumbWidth;
	}
	
	
	function moveTopPageToBottom(){
		var page = _pages[_topPageIndex];
		var bottomPage = _pages[(_topPageIndex + 2) % 3];
		var firstDay = moment(_topPageTime).add('weeks',3*_weeksPerPage);
		page.elem.css('top',bottomPage.elem.position().top+_pageHeight);
		_.each(page.weeks, function(week){
			populateWeek(week,firstDay);
			firstDay.add('week',1);
		});
		_topPageTime.add('weeks',_weeksPerPage);
		_topPageIndex = ((_topPageIndex + 1) % 3);
		return true;
	}
	
	function moveBottomPageToTop(){
		var page = _pages[(_topPageIndex + 2) % 3];
		var topPage = _pages[_topPageIndex];
		var firstDay = moment(_topPageTime).subtract('weeks',_weeksPerPage);
		page.elem.css('top',topPage.elem.position().top-_pageHeight);
		_.each(page.weeks, function(week){
			populateWeek(week,firstDay);
			firstDay.add('week',1);
		});
		_topPageTime.subtract('weeks',_weeksPerPage);
		if (_topPageIndex === 0){
			_topPageIndex = 2;
		}
		else {
			_topPageIndex--;
		}
		return true;
	}
	
	function moveAllPagesTo(topPageTime){
		var firstDay = moment(topPageTime).startOf('week');
		var topPageTop = firstDay.diff(_minLimit,'weeks')*_weekContainerHeight;
		var d = moment(firstDay);
		_topPageTime = moment(firstDay);
		_topPageIndex = 0;
		_.each(_pages,function(page,index){
			page.elem.css('top',(topPageTop+index*_pageHeight));
			_.each(page.weeks,function(week){
				populateWeek(week,d);
				d.add('weeks',1);
			});
		});
		_scroller.animate({'scrollTop':topPageTop+_pageHeight*0.75},{'duration':500,'easing':'swing'});
	}
	
	function moveTo(time){
		var newTopPageTime = moment(time).startOf('day').startOf('week').subtract('weeks',_weeksPerPage);
		_selectedTime = time;
		moveAllPagesTo(newTopPageTime);
	}

	scrollingCalConst = function(containers, min, max, monthThumbsUrlResolver){
		init(containers, min, max);
		if (_.isFunction(monthThumbsUrlResolver)){
			_monthThumbsUrlResolver = monthThumbsUrlResolver;
		}
		moveAllPagesTo(min);
	};
		
	scrollingCalConst.prototype.scrollTo = function(time){
		moveTo(time);
	};
	
	scrollingCalConst.prototype.addSelectionListener = function(listener){
		if (_.isFunction(listener)){
			_timeChangeListeners.push(listener);
		}
	};
	
	return scrollingCalConst;
	})();