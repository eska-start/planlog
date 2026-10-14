CREATE TABLE `trip_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','editor') NOT NULL DEFAULT 'editor',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`inviteToken` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trip_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `trip_shares_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
ALTER TABLE `itinerary_items` ADD `sourceType` varchar(20) DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `itinerary_items` ADD `sourceId` int;