$(function() {
		var start = moment('2013-11-30','YYYY-MM-DD');
		var end = moment().startOf('day');
		var host = "http://data.metanimi.com.s3-website-eu-west-1.amazonaws.com";
		
		var thumbnailProvider = function(time){
			if ((time.isSame(start,'day') || time.isAfter(start)) && time.isBefore(end)){
				return host+"/thumbs/radar/fin_south/thumbs_"+time.format('YYYY-MM')+".png";					
			}
			else {
				return "";
			}
		};
		
    var anim = new com.metanimi.VideoAnimator($('#container'),
			host+'/video/radar/daily/fin_south/',thumbnailProvider, function(){
				anim.setTime(moment(end).subtract(2,'days'));
			});
		
		var cal = new com.metanimi.ScrollingCalendar($('#calcontainer'),start,end,thumbnailProvider);
		
		anim.registerCalendarComponent({
			open: function(currentTime){
				$('#calcontainer').show(500,function(){
					cal.scrollTo(currentTime);						
				});
			},
			addSelectionListener: function(listener){
				cal.addSelectionListener(function(time){
					$('#calcontainer').hide(300, function(){
						listener(time);								
					});
				});
			}
		});		
});