<?php
/**
 * AJAX endpoints for managing eo-maps
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

add_action( 'wp_ajax_eo_maps_save_map', 'eo_maps_ajax_save_map' );
add_action( 'wp_ajax_eo_maps_delete_map', 'eo_maps_ajax_delete_map' );

/**
 * Save map and its markers
 */
function eo_maps_ajax_save_map() {
	check_ajax_referer( 'eo_maps_admin_nonce', 'nonce' );

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( array( 'message' => __( 'Vous n\'avez pas la permission de faire cela.', 'eo-blocks' ) ), 403 );
	}

	$map_id = isset( $_POST['map_id'] ) ? intval( $_POST['map_id'] ) : 0;
	$title  = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : __( 'Sans titre', 'eo-blocks' );

	// Prepare post data
	$post_data = array(
		'post_title'  => $title,
		'post_type'   => 'eo-map',
		'post_status' => 'publish',
	);

	if ( $map_id > 0 ) {
		$post_data['ID'] = $map_id;
		$post_id = wp_update_post( $post_data );
	} else {
		$post_id = wp_insert_post( $post_data );
	}

	if ( is_wp_error( $post_id ) || ! $post_id ) {
		wp_send_json_error( array( 'message' => __( 'Erreur lors de la sauvegarde de la carte.', 'eo-blocks' ) ) );
	}

	// Sanitize and save settings
	$settings = isset( $_POST['settings'] ) ? json_decode( wp_unslash( $_POST['settings'] ), true ) : array();
	$sanitized_settings = array(
		'width'     => sanitize_text_field( $settings['width'] ?? '100%' ),
		'height'    => sanitize_text_field( $settings['height'] ?? '600px' ),
		'zoom'      => intval( $settings['zoom'] ?? 2 ),
		'minZoom'   => intval( $settings['minZoom'] ?? 0 ),
		'maxZoom'   => intval( $settings['maxZoom'] ?? 19 ),
		'centerLat' => floatval( $settings['centerLat'] ?? 0.0 ),
		'centerLng' => floatval( $settings['centerLng'] ?? 0.0 ),
		'tileStyle' => sanitize_text_field( $settings['tileStyle'] ?? 'osm' ),
		'mapLanguage' => sanitize_text_field( $settings['mapLanguage'] ?? 'local' ),
		'mapDesign' => sanitize_text_field( $settings['mapDesign'] ?? 'positron' ),
	);

	// Sanitize and save markers
	$markers = isset( $_POST['markers'] ) ? json_decode( wp_unslash( $_POST['markers'] ), true ) : array();
	$sanitized_markers = array();

	if ( is_array( $markers ) ) {
		foreach ( $markers as $marker ) {
			$gallery = array();
			if ( isset( $marker['gallery'] ) && is_array( $marker['gallery'] ) ) {
				foreach ( $marker['gallery'] as $img ) {
					$gallery[] = esc_url_raw( $img );
				}
			}
			$sanitized_markers[] = array(
				'id'          => sanitize_text_field( $marker['id'] ?? uniqid() ),
				'title'       => sanitize_text_field( $marker['title'] ?? '' ),
				'description' => wp_kses_post( $marker['description'] ?? '' ),
				'lat'         => floatval( $marker['lat'] ?? 0.0 ),
				'lng'         => floatval( $marker['lng'] ?? 0.0 ),
				'url'         => esc_url_raw( $marker['url'] ?? '' ),
				'link_label'  => sanitize_text_field( $marker['link_label'] ?? '' ),
				'phone'       => sanitize_text_field( $marker['phone'] ?? '' ),
				'icon'        => esc_url_raw( $marker['icon'] ?? '' ),
				'category'    => sanitize_text_field( $marker['category'] ?? '' ),
				'marker_type' => sanitize_text_field( $marker['marker_type'] ?? 'default' ),
				'color'       => sanitize_text_field( $marker['color'] ?? '#0066FF' ),
				'animation'   => sanitize_text_field( $marker['animation'] ?? 'bounce' ),
				'gallery'     => $gallery,
			);
		}
	}

	update_post_meta( $post_id, '_eo_map_settings', $sanitized_settings );
	update_post_meta( $post_id, '_eo_map_markers', $sanitized_markers );

	wp_send_json_success( array(
		'message' => __( 'Carte sauvegardée avec succès.', 'eo-blocks' ),
		'map_id'  => $post_id,
	) );
}

/**
 * Delete a map
 */
function eo_maps_ajax_delete_map() {
	check_ajax_referer( 'eo_maps_admin_nonce', 'nonce' );

	if ( ! current_user_can( 'manage_options' ) ) {
		wp_send_json_error( array( 'message' => __( 'Vous n\'avez pas la permission de faire cela.', 'eo-blocks' ) ), 403 );
	}

	$map_id = isset( $_POST['map_id'] ) ? intval( $_POST['map_id'] ) : 0;

	if ( ! $map_id || 'eo-map' !== get_post_type( $map_id ) ) {
		wp_send_json_error( array( 'message' => __( 'Identifiant de carte invalide.', 'eo-blocks' ) ) );
	}

	$deleted = wp_delete_post( $map_id, true );

	if ( ! $deleted ) {
		wp_send_json_error( array( 'message' => __( 'Erreur lors de la suppression de la carte.', 'eo-blocks' ) ) );
	}

	wp_send_json_success( array(
		'message' => __( 'Carte supprimée avec succès.', 'eo-blocks' ),
	) );
}
