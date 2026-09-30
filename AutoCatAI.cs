using System.CollectionsCollections;
using UnityEngine;
using UnityEngine.AI;

[RequireComponent(typeof(NavMeshAgent))]
[RequireComponent(typeof(Animator))]
public class AutoCatAI : MonoBehaviour
{
    public enum CatState { Idle, Wandering, Running, Eating, Sleeping }

    [Header("Cat Settings")]
    public CatState currentState = CatState.Idle;
    public Transform foodBowl;
    public Transform bedPoint;
    public float wanderRadius = 10f;

    [Header("Animation Parameters (Animator Parameters)")]
    public string speedParam = "Speed";
    public string isSleepingParam = "IsSleeping";
    public string isEatingParam = "IsEating";

    private NavMeshAgent agent;
    private Animator animator;
    private bool isStateChanging = false;

    void Start()
    {
        agent = GetComponent<NavMeshAgent>();
        animator = GetComponent<Animator>();
        
        // স্বয়ংক্রিয় আচরণের লুপ শুরু
        StartCoroutine(CatBrainLoop());
    }

    void Update()
    {
        // অ্যানিমেটর প্যারামিটারে স্পিড পাস করা (Idle, Walk, Run অ্যানিমেশন ব্লেন্ড করার জন্য)
        if (animator != null)
        {
            animator.SetFloat(speedParam, agent.velocity.magnitude);
        }
    }

    // বিড়ালের মেইন এআই সিদ্ধান্ত গ্রহণ লুপ
    IEnumerator CatBrainLoop()
    {
        while (true)
        {
            if (!isStateChanging)
            {
                // এলোমেলোভাবে পরবর্তী অবস্থা (State) নির্বাচন
                int randomState = Random.Range(0, 5);
                switch (randomState)
                {
                    case 0:
                        yield return StartCoroutine(DoIdle());
                        break;
                    case 1:
                        yield return StartCoroutine(DoWander(3.5f)); // সাধারণ হাঁটা
                        break;
                    case 2:
                        yield return StartCoroutine(DoRun(7.0f));    // দ্রুত দৌড়ানো ও লাফানো
                        break;
                    case 3:
                        yield return StartCoroutine(DoEat());
                        break;
                    case 4:
                        yield return StartCoroutine(DoSleep());
                        break;
                }
            }
            yield return null;
        }
    }

    // ১. অলসভাবে দাঁড়িয়ে/বসে থাকা
    IEnumerator DoIdle()
    {
        isStateChanging = true;
        currentState = CatState.Idle;
        agent.ResetPath();
        
        float idleTime = Random.Range(3f, 8f);
        yield return new WaitForSeconds(idleTime);
        isStateChanging = false;
    }

    // ২. ঘরে এলোমেলো হেঁটে বেড়ানো
    IEnumerator DoWander(float speed)
    {
        isStateChanging = true;
        currentState = CatState.Wandering;
        agent.speed = speed;

        Vector3 newPos = GetRandomNavMeshPosition(transform.position, wanderRadius);
        agent.SetDestination(newPos);

        float timeout = 10f;
        while (agent.pathPending || agent.remainingDistance > 0.5f)
        {
            timeout -= Time.deltaTime;
            if (timeout <= 0) break; // আটকে গেলে স্কিপ করবে
            yield return null;
        }

        isStateChanging = false;
    }

    // ৩. দ্রুত দৌড়ানো
    IEnumerator DoRun(float speed)
    {
        isStateChanging = true;
        currentState = CatState.Running;
        agent.speed = speed;

        // দ্রুত ২টি আলাদা জায়গায় দৌড়াবে
        for (int i = 0; i < 2; i++)
        {
            Vector3 runPos = GetRandomNavMeshPosition(transform.position, wanderRadius * 1.5f);
            agent.SetDestination(runPos);
            
            float timeout = 8f;
            while (agent.pathPending || agent.remainingDistance > 0.5f)
            {
                timeout -= Time.deltaTime;
                if (timeout <= 0) break;
                yield return null;
            }
        }

        isStateChanging = false;
    }

    // ৪. খাবার বাটির কাছে গিয়ে খাওয়া
    IEnumerator DoEat()
    {
        if (foodBowl == null) yield break;

        isStateChanging = true;
        currentState = CatState.Eating;
        agent.speed = 3.5f;
        agent.SetDestination(foodBowl.position);

        while (agent.pathPending || agent.remainingDistance > 1.2f)
        {
            yield return null;
        }

        // খাওয়ার অ্যানিমেশন প্লে করা
        animator.SetBool(isEatingParam, true);
        float eatDuration = Random.Range(5f, 12f);
        yield return new WaitForSeconds(eatDuration);
        animator.SetBool(isEatingParam, false);

        isStateChanging = false;
    }

    // ৫. বিছানায় গিয়ে ঘুমানো
    IEnumerator DoSleep()
    {
        if (bedPoint == null) yield break;

        isStateChanging = true;
        currentState = CatState.Sleeping;
        agent.speed = 2.5f;
        agent.SetDestination(bedPoint.position);

        while (agent.pathPending || agent.remainingDistance > 0.8f)
        {
            yield return null;
        }

        // ঘুমানোর অ্যানিমেশন প্লে করা
        animator.SetBool(isSleepingParam, true);
        float sleepDuration = Random.Range(10f, 25f);
        yield return new WaitForSeconds(sleepDuration);
        animator.SetBool(isSleepingParam, false);

        isStateChanging = false;
    }

    // র‍্যান্ডম নেভমেশ পজিশন গণনা করার মেথড
    Vector3 GetRandomNavMeshPosition(Vector3 center, float range)
    {
        Vector3 randomDirection = Random.insideUnitSphere * range;
        randomDirection += center;
        NavMeshHit hit;
        if (NavMesh.SamplePosition(randomDirection, out hit, range, NavMesh.AllAreas))
        {
            return hit.position;
        }
        return center;
    }
}
