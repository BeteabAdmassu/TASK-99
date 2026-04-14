-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `organizations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email_encrypted` VARBINARY(512) NULL,
    `role` ENUM('admin', 'moderator', 'analyst', 'user') NOT NULL DEFAULT 'user',
    `is_banned` BOOLEAN NOT NULL DEFAULT false,
    `banned_at` DATETIME(3) NULL,
    `banned_by` VARCHAR(36) NULL,
    `ban_reason` TEXT NULL,
    `is_muted` BOOLEAN NOT NULL DEFAULT false,
    `muted_until` DATETIME(3) NULL,
    `muted_by` VARCHAR(36) NULL,
    `mute_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `users_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `users_organization_id_username_key`(`organization_id`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `user_id` VARCHAR(36) NOT NULL,
    `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `success` BOOLEAN NOT NULL,
    `ip_address` VARCHAR(45) NULL,

    INDEX `login_attempts_user_id_attempted_at_idx`(`user_id`, `attempted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_lockouts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `user_id` VARCHAR(36) NOT NULL,
    `locked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `account_lockouts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_sections` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `forum_sections_organization_id_idx`(`organization_id`),
    INDEX `forum_sections_organization_id_display_order_idx`(`organization_id`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forum_subsections` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `section_id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `forum_subsections_section_id_idx`(`section_id`),
    INDEX `forum_subsections_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `threads` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `subsection_id` VARCHAR(36) NOT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_locked` BOOLEAN NOT NULL DEFAULT false,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `reply_count` INTEGER NOT NULL DEFAULT 0,
    `last_activity_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,
    `deleted_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `threads_organization_id_idx`(`organization_id`),
    INDEX `threads_subsection_id_idx`(`subsection_id`),
    INDEX `threads_author_id_idx`(`author_id`),
    INDEX `threads_deleted_at_idx`(`deleted_at`),
    INDEX `threads_subsection_id_is_pinned_idx`(`subsection_id`, `is_pinned`),
    INDEX `threads_subsection_id_last_activity_at_idx`(`subsection_id`, `last_activity_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `replies` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `thread_id` VARCHAR(36) NOT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `parent_reply_id` VARCHAR(36) NULL,
    `depth` TINYINT NOT NULL DEFAULT 1,
    `body` TEXT NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `deleted_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `replies_thread_id_idx`(`thread_id`),
    INDEX `replies_organization_id_idx`(`organization_id`),
    INDEX `replies_parent_reply_id_idx`(`parent_reply_id`),
    INDEX `replies_author_id_idx`(`author_id`),
    INDEX `replies_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `category` VARCHAR(100) NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tags_organization_id_idx`(`organization_id`),
    INDEX `tags_organization_id_category_idx`(`organization_id`, `category`),
    UNIQUE INDEX `tags_organization_id_slug_key`(`organization_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread_tags` (
    `thread_id` VARCHAR(36) NOT NULL,
    `tag_id` VARCHAR(36) NOT NULL,

    INDEX `thread_tags_tag_id_idx`(`tag_id`),
    PRIMARY KEY (`thread_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `announcements_organization_id_idx`(`organization_id`),
    INDEX `announcements_organization_id_start_date_end_date_idx`(`organization_id`, `start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carousel_items` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `image_url` VARCHAR(1000) NULL,
    `link_url` VARCHAR(1000) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `carousel_items_organization_id_idx`(`organization_id`),
    INDEX `carousel_items_organization_id_start_date_end_date_idx`(`organization_id`, `start_date`, `end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venues` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `capacity` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `venues_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_bookings` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `venue_id` VARCHAR(36) NOT NULL,
    `booked_by` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `status` ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `venue_bookings_venue_id_start_time_end_time_idx`(`venue_id`, `start_time`, `end_time`),
    INDEX `venue_bookings_organization_id_idx`(`organization_id`),
    INDEX `venue_bookings_booked_by_idx`(`booked_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` TEXT NOT NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` VARCHAR(36) NULL,
    `status` ENUM('pending', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'pending',
    `scheduled_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `read_at` DATETIME(3) NULL,
    `retry_count` TINYINT NOT NULL DEFAULT 0,
    `last_retry_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_status_idx`(`user_id`, `status`),
    INDEX `notifications_organization_id_idx`(`organization_id`),
    INDEX `notifications_status_scheduled_at_idx`(`status`, `scheduled_at`),
    INDEX `notifications_status_retry_count_last_retry_at_idx`(`status`, `retry_count`, `last_retry_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_subscriptions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `user_id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `is_subscribed` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_subscriptions_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `notification_subscriptions_user_id_organization_id_category_key`(`user_id`, `organization_id`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `actor_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource_type` VARCHAR(50) NULL,
    `resource_id` VARCHAR(36) NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `correlation_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_idx`(`organization_id`),
    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `audit_logs_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_logs_organization_id_event_type_idx`(`organization_id`, `event_type`),
    INDEX `event_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `event_logs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anomaly_flags` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `flagged_user_id` VARCHAR(36) NULL,
    `flagged_thread_id` VARCHAR(36) NULL,
    `rule_name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    `status` ENUM('open', 'acknowledged', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `resolved_by` VARCHAR(36) NULL,

    INDEX `anomaly_flags_organization_id_idx`(`organization_id`),
    INDEX `anomaly_flags_organization_id_status_idx`(`organization_id`, `status`),
    INDEX `anomaly_flags_flagged_user_id_idx`(`flagged_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flags` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `flag_key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `description` VARCHAR(500) NULL,
    `updated_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feature_flags_organization_id_flag_key_key`(`organization_id`, `flag_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread_reports` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `organization_id` VARCHAR(36) NOT NULL,
    `thread_id` VARCHAR(36) NOT NULL,
    `reported_by` VARCHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'reviewed', 'dismissed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thread_reports_thread_id_idx`(`thread_id`),
    INDEX `thread_reports_organization_id_idx`(`organization_id`),
    INDEX `thread_reports_thread_id_created_at_idx`(`thread_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `token_blacklist` (
    `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
    `token_jti` VARCHAR(36) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `token_blacklist_token_jti_key`(`token_jti`),
    INDEX `token_blacklist_token_jti_idx`(`token_jti`),
    INDEX `token_blacklist_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_attempts` ADD CONSTRAINT `login_attempts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_lockouts` ADD CONSTRAINT `account_lockouts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_sections` ADD CONSTRAINT `forum_sections_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_subsections` ADD CONSTRAINT `forum_subsections_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `forum_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forum_subsections` ADD CONSTRAINT `forum_subsections_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `threads` ADD CONSTRAINT `threads_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `threads` ADD CONSTRAINT `threads_subsection_id_fkey` FOREIGN KEY (`subsection_id`) REFERENCES `forum_subsections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `threads` ADD CONSTRAINT `threads_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `threads` ADD CONSTRAINT `threads_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replies` ADD CONSTRAINT `replies_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replies` ADD CONSTRAINT `replies_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replies` ADD CONSTRAINT `replies_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replies` ADD CONSTRAINT `replies_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replies` ADD CONSTRAINT `replies_parent_reply_id_fkey` FOREIGN KEY (`parent_reply_id`) REFERENCES `replies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_tags` ADD CONSTRAINT `thread_tags_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_tags` ADD CONSTRAINT `thread_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carousel_items` ADD CONSTRAINT `carousel_items_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carousel_items` ADD CONSTRAINT `carousel_items_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venues` ADD CONSTRAINT `venues_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_bookings` ADD CONSTRAINT `venue_bookings_booked_by_fkey` FOREIGN KEY (`booked_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_subscriptions` ADD CONSTRAINT `notification_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_subscriptions` ADD CONSTRAINT `notification_subscriptions_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_logs` ADD CONSTRAINT `event_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_logs` ADD CONSTRAINT `event_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomaly_flags` ADD CONSTRAINT `anomaly_flags_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomaly_flags` ADD CONSTRAINT `anomaly_flags_flagged_user_id_fkey` FOREIGN KEY (`flagged_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomaly_flags` ADD CONSTRAINT `anomaly_flags_flagged_thread_id_fkey` FOREIGN KEY (`flagged_thread_id`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomaly_flags` ADD CONSTRAINT `anomaly_flags_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_flags` ADD CONSTRAINT `feature_flags_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_flags` ADD CONSTRAINT `feature_flags_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_reports` ADD CONSTRAINT `thread_reports_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_reports` ADD CONSTRAINT `thread_reports_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_reports` ADD CONSTRAINT `thread_reports_reported_by_fkey` FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
