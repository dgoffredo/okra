start transaction;

create table `rank`(
    `id` int not null,
    `name` varchar(255) not null,
    `description` varchar(512) null,
    primary key (`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout`(
    `id` varchar(255) not null comment 'RFC 4122 UUID',
    `full_name` varchar(512) null comment 'e.g. Samayamantri Venkata Rama Naga Butchi Anjaneya Satya Krishna Vijay',
    `short_name` varchar(512) null comment 'e.g. Alice',
    `birthdate` date null,
    `join_time` timestamp(6) null,
    `country_code` varchar(512) null comment 'ISO 3166-1 alpha-3 upper-case',
    `language_code` varchar(512) null comment 'ISO 639-1 two-character lower-case',
    `pack_code` int unsigned null comment 'as administered by the Head Wolf',
    `rank` int null,
    `iana_country_code` varchar(512) null comment 'playing with naming conventions',
    `what_about_this` bigint null,
    primary key (`id`),
    foreign key (`rank`) references `rank`(`id`))
engine = InnoDB
character set utf8mb4;

create table `badge`(
    `id` int not null,
    `name` varchar(255) not null,
    `description` varchar(512) null,
    primary key (`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout_badges`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `ordinality` int unsigned not null comment 'zero-based position within the array',
    `value` int null comment 'one of the badges in some .scouts.BoyScout',
    primary key (`id`, `ordinality`),
    foreign key (`id`) references `boy_scout`(`id`),
    foreign key (`value`) references `badge`(`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout_favorite_songs`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `ordinality` int unsigned not null comment 'zero-based position within the array',
    `value` varchar(512) null comment 'one of the favorite_songs in some .scouts.BoyScout',
    primary key (`id`, `ordinality`),
    foreign key (`id`) references `boy_scout`(`id`))
engine = InnoDB
character set utf8mb4
comment = 'formatted as  "Artist Name - Song Title"';

create table `boy_scout_camping_trips`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `ordinality` int unsigned not null comment 'zero-based position within the array',
    `value` date null comment 'one of the camping_trips in some .scouts.BoyScout',
    primary key (`id`, `ordinality`),
    foreign key (`id`) references `boy_scout`(`id`))
engine = InnoDB
character set utf8mb4
comment = 'do we end up with an array of pointers?';

create table `boy_scout_mask`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `ordinality` int unsigned not null comment 'zero-based position within the array',
    `value` varchar(255) null comment 'one of the fields named by mask in some .scouts.BoyScout',
    primary key (`id`, `ordinality`),
    foreign key (`id`) references `boy_scout`(`id`))
engine = InnoDB
character set utf8mb4
comment = 'testing field masks';

create table `girl_scout`(
    `id` varchar(255) not null comment 'RFC 4122 UUID',
    primary key (`id`))
engine = InnoDB
character set utf8mb4;

insert into `rank` (`id`, `name`, `description`) values
(0, 'RANK_UNKNOWN', null),
(1, 'RANK_CUB_SCOUT', null),
(2, 'RANK_WEBELO', 'I was one of these briefly'),
(3, 'RANK_BOY_SCOUT', null),
(4, 'RANK_EAGLE_SCOUT', null),
(5, 'RANK_SPACE_CADET', null),
(6, 'RANK_SAMURAI', null),
(7, 'RANK_PROFESSIONAL_BOWLER', 'there''s nothing after');

insert into `badge` (`id`, `name`, `description`) values
(0, 'BADGE_UNKNOWN', null),
(1, 'BADGE_WOODWORKING', null),
(2, 'BADGE_FIRESTARTING', null),
(3, 'BADGE_RAINMAKING', null),
(4, 'BADGE_ASSKICKING', null),
(5, 'BADGE_HEADSCRATCHING', null),
(6, 'BADGE_BALLET', 'sometimes given out for jazz'),
(7, 'BADGE_FISHING', null);

commit;
