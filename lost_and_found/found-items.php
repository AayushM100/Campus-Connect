<?php

require_once "../config/database.php";


// Get all FOUND items from found_items table
$sql = "SELECT
            serial_number,
            roll_number,
            item_name,
            location,
            status,
            person_name,
            contact_number,
            description
        FROM found_items
        WHERE LOWER(status) = 'found'
        ORDER BY serial_number DESC";

$result = $conn->query($sql);

if (!$result) {
    die("Database Error: " . $conn->error);
}

?>

<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Found Items - Campus Lost & Found</title>

        <link rel="stylesheet" href="../Main/tokens.css">
    <script>
      (function() {
        var t = localStorage.getItem('campusConnectTheme') || localStorage.getItem('campusBitesTheme') || (localStorage.getItem('darkMode') === 'true' ? 'dark' : null) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', t);
        if (t === 'dark') {
          if (document.body) document.body.classList.add('dark-mode');
          else document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('dark-mode'); });
        }
      })();
    </script>
    <link rel="stylesheet" href="lost.css">

</head>


<body>


    <!-- ================= NAVIGATION BAR ================= -->

    <header class="navbar">

        <div class="logo">

            🎓 Campus Lost & Found

        </div>


        <nav>

            <a href="lost.php">
                Home
            </a>

            <a href="lost-items.php">
                Lost Items
            </a>

            <a href="found-items.php">
                Found Items
            </a>

            <a href="browse.html">
                Browse Items
            </a>

                    <a href="../index.html" class="portal-nav-link">← CampusConnect</a>
            <button type="button" class="cc-theme-toggle" aria-label="Toggle theme"></button>
        </nav>


        <a
            href="lost.php#report"
            class="login-btn"
        >
            Report Item →
        </a>

    </header>



    <!-- ================= FOUND ITEMS SECTION ================= -->

    <section class="items-page">


        <div class="items-heading">

            <p class="small-heading">
                FOUND ITEMS
            </p>

            <h1>
                Items that are <span>Found</span>
            </h1>

            <p>
                Browse items that have been found by students on campus.
                You may find something that belongs to you.
            </p>

        </div>



        <!-- ================= FOUND ITEMS ================= -->

        <div class="items-grid">


            <?php if ($result->num_rows > 0): ?>


                <?php while ($row = $result->fetch_assoc()): ?>


                    <div class="item-card">


                        <div class="item-image">

                            🎒

                        </div>


                        <h3>

                            <?php
                            echo htmlspecialchars($row["item_name"]);
                            ?>

                        </h3>


                        <p>

                            <?php
                            echo htmlspecialchars(
                                $row["description"]
                            );
                            ?>

                        </p>


                        <p>

                            <strong>
                                Location:
                            </strong>

                            <?php
                            echo htmlspecialchars(
                                $row["location"]
                            );
                            ?>

                        </p>


                        <button
                            class="view-details"
                            data-name="<?php echo htmlspecialchars($row["item_name"]); ?>"
                            data-status="<?php echo htmlspecialchars($row["status"]); ?>"
                            data-location="<?php echo htmlspecialchars($row["location"]); ?>"
                        >

                            View Details

                        </button>


                    </div>


                <?php endwhile; ?>


            <?php else: ?>


                <p>
                    No found items reported yet.
                </p>


            <?php endif; ?>


        </div>


    </section>



    <!-- ================= FOOTER ================= -->

    <footer>

        <p>
            © 2026 Campus Lost & Found
        </p>

    </footer>


        <script src="../Main/theme.js"></script>
    <script src="../Main/vendor/gsap.min.js"></script>
    <script src="../Main/vendor/ScrollTrigger.min.js"></script>
    <script src="../Main/gsap-motion.js"></script>
    <script src="lost.js"></script>


</body>

</html>

<?php

$conn->close();

?>