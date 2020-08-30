alter table `grill`
add column `is_on` bool null;

insert into `hotdog` (`id`, `name`, `description`) values
(4, 'CARROT', 'for the vegans');
