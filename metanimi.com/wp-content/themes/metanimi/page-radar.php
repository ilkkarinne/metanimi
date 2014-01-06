<?php
/**
 * The template for displaying all pages.
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site will use a
 * different template.
 *
 * @package WordPress
 * @subpackage Twenty_Eleven
 * @since Twenty Eleven 1.0
 */

get_header(); ?>
		<div id="primary">
			<div id="container"></div>
	  	<div id="logo">
				<h2><?php the_title(); ?></h2>
				<p class="description">
					<?php the_content(); ?>
				</div>
			</div>
			<div id="calcontainer"></div>
		</div><!-- #primary -->
<?php get_footer(); ?>