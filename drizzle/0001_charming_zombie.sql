CREATE TABLE `accommodations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` varchar(500),
	`checkIn` varchar(10),
	`checkOut` varchar(10),
	`bookingRef` varchar(50),
	`price` decimal(10,2),
	`currency` varchar(10) DEFAULT 'KRW',
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accommodations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `diary_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`title` varchar(255),
	`content` text,
	`mood` enum('amazing','happy','neutral','tired','sad') DEFAULT 'happy',
	`weather` enum('sunny','cloudy','rainy','snowy','windy') DEFAULT 'sunny',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `diary_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('departure','return','transit') NOT NULL DEFAULT 'departure',
	`airline` varchar(100),
	`flightNumber` varchar(20),
	`departureAirport` varchar(100),
	`arrivalAirport` varchar(100),
	`departureTime` varchar(20),
	`arrivalTime` varchar(20),
	`bookingRef` varchar(50),
	`seatNumber` varchar(20),
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `flights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itinerary_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`order` int DEFAULT 0,
	`placeName` varchar(255) NOT NULL,
	`address` varchar(500),
	`lat` decimal(10,7),
	`lng` decimal(10,7),
	`visitTime` varchar(10),
	`duration` int,
	`visited` boolean DEFAULT false,
	`memo` text,
	`category` varchar(50) DEFAULT 'place',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `itinerary_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`content` text,
	`pinned` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`company` varchar(100),
	`carModel` varchar(100),
	`pickupLocation` varchar(255),
	`dropoffLocation` varchar(255),
	`pickupTime` varchar(20),
	`dropoffTime` varchar(20),
	`bookingRef` varchar(50),
	`price` decimal(10,2),
	`currency` varchar(10) DEFAULT 'KRW',
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rentals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`destination` varchar(255) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`coverColor` varchar(32) DEFAULT '#6366f1',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trips_id` PRIMARY KEY(`id`)
);
